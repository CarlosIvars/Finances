import os
import time
import secrets
import logging
from django.shortcuts import redirect
from django.http import HttpResponse
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.db.models import Q
from api.models import Transaction, AuditLog
from api.oauth_service import GoogleOAuthService
from .models import Document, GmailAccount
from .serializers import DocumentSerializer, GmailAccountSerializer
from .storage import get_storage_manager
from .matcher_service import MatcherService
from .gmail_service import GmailSyncService

logger = logging.getLogger('api')


class DocumentViewSet(viewsets.ModelViewSet):
    """Gestión de documentos adjuntos (facturas, tickets, justificantes)."""
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Document.objects.filter(user=user).select_related('transaction', 'suggested_transaction')

        # Filtros
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        has_tx = self.request.query_params.get('has_transaction')
        if has_tx is not None:
            if has_tx.lower() in ('true', '1'):
                queryset = queryset.filter(transaction__isnull=False)
            elif has_tx.lower() in ('false', '0'):
                queryset = queryset.filter(transaction__isnull=True)

        tx_id = self.request.query_params.get('transaction_id')
        if tx_id:
            queryset = queryset.filter(transaction_id=tx_id)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(file_name__icontains=search) |
                Q(email_subject__icontains=search) |
                Q(email_sender__icontains=search) |
                Q(transaction__description__icontains=search)
            )

        return queryset

    def perform_destroy(self, instance):
        storage = get_storage_manager()
        storage.delete_file(instance)
        instance.delete()

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Aprueba una sugerencia de vinculación entre documento y transacción."""
        doc = self.get_object()
        success = MatcherService.confirm_match(doc, request.user)
        if success:
            serializer = self.get_serializer(doc)
            return Response({'status': 'confirmed', 'document': serializer.data})
        return Response({'error': 'No hay sugerencia pendiente válida para confirmar.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject_suggestion(self, request, pk=None):
        """Descarta la sugerencia de vinculación."""
        doc = self.get_object()
        success = MatcherService.reject_suggestion(doc, request.user)
        if success:
            serializer = self.get_serializer(doc)
            return Response({'status': 'rejected', 'document': serializer.data})
        return Response({'error': 'Error descartando sugerencia.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def link(self, request, pk=None):
        """Vincula manualmente el documento a una transacción especificada."""
        doc = self.get_object()
        tx_id = request.data.get('transaction_id')
        if not tx_id:
            return Response({'error': 'transaction_id es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tx = Transaction.objects.get(id=tx_id, user=request.user)
        except Transaction.DoesNotExist:
            return Response({'error': 'Transacción no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        success = MatcherService.link_transaction(doc, tx, request.user)
        if success:
            serializer = self.get_serializer(doc)
            return Response({'status': 'linked', 'document': serializer.data})
        return Response({'error': 'No se pudo vincular la transacción.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def unlink(self, request, pk=None):
        """Desvincula el documento de su transacción actual."""
        doc = self.get_object()
        success = MatcherService.unlink_transaction(doc, request.user)
        if success:
            serializer = self.get_serializer(doc)
            return Response({'status': 'unlinked', 'document': serializer.data})
        return Response({'error': 'No se pudo desvincular el documento.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """Subida manual de un archivo (PDF o imagen)."""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No se ha adjuntado ningún archivo.'}, status=status.HTTP_400_BAD_REQUEST)

        content = file_obj.read()
        storage = get_storage_manager()
        mime_type = file_obj.content_type or 'application/pdf'
        saved_meta = storage.save_file(request.user.id, file_obj.name, content, mime_type)

        tx_id = request.data.get('transaction_id')
        target_tx = None
        if tx_id:
            try:
                target_tx = Transaction.objects.get(id=tx_id, user=request.user)
            except Transaction.DoesNotExist:
                pass

        doc = Document.objects.create(
            user=request.user,
            storage_path=saved_meta['storage_path'],
            file=saved_meta['storage_path'],
            file_name=saved_meta['file_name'],
            file_size=saved_meta['file_size'],
            mime_type=mime_type,
            file_hash=saved_meta['file_hash'],
            transaction=target_tx,
            status='confirmed' if target_tx else 'unmatched'
        )

        if not target_tx:
            MatcherService.match_document(doc)

        serializer = self.get_serializer(doc)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class GmailAuthUrlView(APIView):
    """
    Genera la URL de autorización OAuth2 para conectar Gmail.
    Exige autenticación previa y genera state + PKCE vinculados a la sesión del usuario.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        redirect_uri = os.environ.get(
            'GOOGLE_GMAIL_REDIRECT_URI',
            'http://localhost:8000/api/documents/gmail/callback/'
        )
        state = secrets.token_urlsafe(32)
        code_verifier, code_challenge = GoogleOAuthService.generate_pkce()

        # Guardar en sesión server-side vinculado al usuario actual
        request.session['gmail_oauth_state'] = state
        request.session['gmail_oauth_verifier'] = code_verifier
        request.session['gmail_oauth_user_id'] = request.user.id
        request.session['gmail_oauth_created_at'] = time.time()
        request.session['gmail_oauth_used'] = False
        request.session.modified = True

        client_id = GoogleOAuthService.get_client_id()
        if not client_id:
            return Response({'error': 'GOOGLE_CLIENT_ID no configurado'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        import urllib.parse
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
            'state': state,
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256',
            'access_type': 'offline',
            'prompt': 'consent',
        }
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
        return Response({'auth_url': auth_url})


class GmailCallbackView(APIView):
    """Callback OAuth2 de Google para conectar cuenta de Gmail."""
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get('code')
        state = request.query_params.get('state', '')
        error = request.query_params.get('error')
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

        if error:
            logger.warning(f"Error devuelto por Google en flujo Gmail: {error}")
            return redirect(f"{frontend_url}/?tab=documents&gmail_error={error}")

        if not code or not state:
            return HttpResponse("<h3>Código o estado ausente.</h3>", status=400)

        # 1. Validar y consumir state de un solo uso
        try:
            _, code_verifier = GoogleOAuthService.validate_and_consume_state(
                request.session, state, session_key_prefix='gmail_oauth'
            )
        except Exception as e:
            logger.error(f"Fallo de validación de OAuth state en Gmail: {str(e)}")
            return HttpResponse(f"<h3>Error de seguridad OAuth en Gmail: {str(e)}</h3>", status=400)

        # 2. Identificar al usuario objetivo (debe coincidir con la sesión activa)
        user = request.user
        if not user or not user.is_authenticated:
            target_user_id = request.session.get('gmail_oauth_user_id')
            if target_user_id:
                try:
                    user = User.objects.get(id=target_user_id)
                except User.DoesNotExist:
                    user = None

        if not user or not user.is_authenticated:
            return HttpResponse("<h3>No se pudo identificar una sesión activa para vincular Gmail.</h3>", status=401)

        redirect_uri = os.environ.get(
            'GOOGLE_GMAIL_REDIRECT_URI',
            'http://localhost:8000/api/documents/gmail/callback/'
        )

        try:
            tokens = GmailSyncService.exchange_code_for_tokens(code, redirect_uri, code_verifier=code_verifier)
            access_token = tokens['access_token']
            refresh_token = tokens.get('refresh_token', '')
            expires_in = tokens.get('expires_in', 3600)
            token_expiry = timezone.now() + timezone.timedelta(seconds=expires_in)

            user_email = GmailSyncService.get_user_email(access_token)

            # Verificar si otra cuenta de usuario ya tiene este mismo email de Gmail vinculado
            existing_gmail = GmailAccount.objects.filter(email=user_email, is_active=True).exclude(user=user).first()
            if existing_gmail:
                return HttpResponse("<h3>Esta cuenta de Gmail ya está vinculada a otro usuario.</h3>", status=409)

            gmail_account, _ = GmailAccount.objects.get_or_create(user=user)
            gmail_account.email = user_email
            gmail_account.set_access_token(access_token)
            if refresh_token:
                gmail_account.set_refresh_token(refresh_token)
            gmail_account.token_expiry = token_expiry
            gmail_account.is_active = True
            gmail_account.save()

            AuditLog.objects.create(
                user=user,
                action='modify',
                resource='gmail_connect',
                details={'gmail_email': user_email}
            )

            return redirect(f"{frontend_url}/?tab=documents&gmail_connected=true")
        except Exception as e:
            logger.error(f"Error en callback Gmail: {str(e)}", exc_info=True)
            return HttpResponse(f"<h3>Error al vincular Gmail: {str(e)}</h3>", status=400)


class GmailSyncView(APIView):
    """Ejecuta la sincronización y escaneo de facturas en Gmail bajo demanda."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            max_results = int(request.data.get('max_results', 30))
            synced_docs = GmailSyncService.sync_invoices(request.user, max_results=max_results)
            return Response({
                'status': 'synced',
                'synced_count': len(synced_docs),
                'documents': DocumentSerializer(synced_docs, many=True).data
            })
        except Exception as e:
            logger.error(f"Error sincronizando Gmail: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GmailStatusView(APIView):
    """Obtiene el estado de conexión de la cuenta de Gmail del usuario."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            gmail_account = GmailAccount.objects.get(user=request.user)
            total_documents = Document.objects.filter(user=request.user).count()
            unmatched_count = Document.objects.filter(user=request.user, status='unmatched').count()
            suggested_count = Document.objects.filter(user=request.user, status='suggested').count()
            matched_count = Document.objects.filter(user=request.user, status__in=['auto_matched', 'confirmed']).count()

            return Response({
                'is_connected': gmail_account.is_active and bool(gmail_account.get_refresh_token() or gmail_account.get_access_token()),
                'email': gmail_account.email,
                'last_sync_at': gmail_account.last_sync_at,
                'sync_query': gmail_account.sync_query,
                'total_documents': total_documents,
                'unmatched_count': unmatched_count,
                'suggested_count': suggested_count,
                'matched_count': matched_count,
            })
        except GmailAccount.DoesNotExist:
            return Response({
                'is_connected': False,
                'email': '',
                'last_sync_at': None,
                'total_documents': 0,
                'unmatched_count': 0,
                'suggested_count': 0,
                'matched_count': 0,
            })

    def delete(self, request):
        """Desconecta la cuenta de Gmail, revoca el token en Google y limpia credenciales."""
        try:
            gmail_account = GmailAccount.objects.get(user=request.user)
            # Revocar tokens en Google
            refresh_tok = gmail_account.get_refresh_token()
            access_tok = gmail_account.get_access_token()
            if refresh_tok:
                GoogleOAuthService.revoke_token(refresh_tok)
            elif access_tok:
                GoogleOAuthService.revoke_token(access_tok)

            gmail_account.is_active = False
            gmail_account.access_token_encrypted = None
            gmail_account.refresh_token_encrypted = None
            gmail_account.save()

            AuditLog.objects.create(
                user=request.user,
                action='modify',
                resource='gmail_disconnect',
                details={'revoked_google': True}
            )

            return Response({'status': 'disconnected'})
        except GmailAccount.DoesNotExist:
            return Response({'status': 'not_found'}, status=status.HTTP_404_NOT_FOUND)


