"""
Views para la app banking (Open Banking).
"""
import logging
import os

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from banking.models import BankConnection, BankAccount, BankTransaction
from banking.serializers import (
    BankConnectionSerializer, BankConnectionDetailSerializer,
    BankAccountSerializer, BankAccountDetailSerializer,
    BankTransactionSerializer,
    CreateConnectionSerializer, InstitutionSerializer,
    SyncLogSerializer,
)
from banking.services.connection_service import ConnectionService
from banking.services.sync_service import SyncService

logger = logging.getLogger('banking')


class InstitutionListView(APIView):
    """
    GET /api/banking/institutions/
    Lista de instituciones bancarias disponibles para conectar.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        service = ConnectionService()
        institutions = service.get_available_institutions()
        serializer = InstitutionSerializer(institutions, many=True)
        return Response(serializer.data)


class BankConnectionViewSet(viewsets.ModelViewSet):
    """
    CRUD de conexiones bancarias del usuario.

    list:   GET    /api/banking/connections/
    create: POST   /api/banking/connections/
    detail: GET    /api/banking/connections/{id}/
    delete: DELETE /api/banking/connections/{id}/
    sync:   POST   /api/banking/connections/{id}/sync/
    """
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        return (
            BankConnection.objects
            .filter(user=self.request.user)
            .prefetch_related('bank_accounts', 'sync_logs')
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateConnectionSerializer
        if self.action == 'retrieve':
            return BankConnectionDetailSerializer
        return BankConnectionSerializer

    def create(self, request):
        """
        Inicia una nueva conexión bancaria.
        POST /api/banking/connections/
        Body: {"institution_id": "sabadell", "redirect_url": "https://..."}
        """
        serializer = CreateConnectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service = ConnectionService()
        redirect_url = serializer.validated_data.get(
            'redirect_url',
            os.environ.get('BANKING_CALLBACK_URL', 'http://localhost:8000/api/banking/callback/'),
        )

        result = service.create_connection(
            user=request.user,
            institution_id=serializer.validated_data['institution_id'],
            redirect_url=redirect_url,
        )

        return Response(result, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        """
        Desconecta un banco (revoca consentimiento).
        DELETE /api/banking/connections/{id}/
        """
        connection = self.get_object()
        service = ConnectionService()
        service.disconnect(connection)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='sync')
    def sync(self, request, pk=None):
        """
        Fuerza sincronización de una conexión.
        POST /api/banking/connections/{id}/sync/
        """
        connection = self.get_object()

        if not connection.is_consent_valid():
            return Response(
                {'error': 'La conexión no tiene un consentimiento válido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = SyncService()
        sync_log = service.sync_connection(connection, sync_type='manual')
        serializer = SyncLogSerializer(sync_log)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='accounts')
    def accounts(self, request, pk=None):
        """
        Cuentas de una conexión.
        GET /api/banking/connections/{id}/accounts/
        """
        connection = self.get_object()
        accounts = connection.bank_accounts.all()
        serializer = BankAccountDetailSerializer(accounts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='sync-logs')
    def sync_logs(self, request, pk=None):
        """
        Historial de sincronizaciones.
        GET /api/banking/connections/{id}/sync-logs/
        """
        connection = self.get_object()
        logs = connection.sync_logs.all()[:20]
        serializer = SyncLogSerializer(logs, many=True)
        return Response(serializer.data)


class BankCallbackView(APIView):
    """
    GET /api/banking/callback/
    Callback de autorización OAuth del banco/proveedor.
    Recibe los parámetros del redirect y activa la conexión.
    """
    # No requiere auth — es un redirect del banco
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Procesa el callback de autorización."""
        connection_id = request.query_params.get('state', '')
        if not connection_id:
            return Response(
                {'error': 'Missing state parameter'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            service = ConnectionService()
            connection = service.handle_callback(
                provider_connection_id=connection_id,
                callback_params=dict(request.query_params),
            )

            # Sincronizar automáticamente tras conexión
            sync_service = SyncService()
            sync_service.sync_connection(connection, sync_type='manual')

            # Redirect al frontend
            frontend_url = os.environ.get(
                'FRONTEND_URL', 'http://localhost:5173',
            )
            from django.shortcuts import redirect
            return redirect(
                f"{frontend_url}/?connection={connection.id}&status=success"
            )

        except BankConnection.DoesNotExist:
            return Response(
                {'error': 'Connection not found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.error("Callback error: %s", str(e))
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class BankAccountTransactionsView(APIView):
    """
    GET /api/banking/accounts/{account_id}/transactions/
    Transacciones de una cuenta bancaria con paginación.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, account_id):
        try:
            bank_account = BankAccount.objects.get(
                id=account_id,
                bank_connection__user=request.user,
            )
        except BankAccount.DoesNotExist:
            return Response(
                {'error': 'Cuenta no encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Filtros opcionales
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        transactions = bank_account.bank_transactions.all()
        if date_from:
            transactions = transactions.filter(booking_date__gte=date_from)
        if date_to:
            transactions = transactions.filter(booking_date__lte=date_to)

        # Paginación simple
        limit = min(int(request.query_params.get('limit', 50)), 200)
        offset = int(request.query_params.get('offset', 0))
        total = transactions.count()
        transactions = transactions[offset:offset + limit]

        serializer = BankTransactionSerializer(transactions, many=True)
        return Response({
            'count': total,
            'limit': limit,
            'offset': offset,
            'results': serializer.data,
        })

