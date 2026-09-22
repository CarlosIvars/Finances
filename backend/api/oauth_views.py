import os
import logging
from django.shortcuts import redirect
from django.http import HttpResponse, JsonResponse
from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import UserProfile, AuditLog
from .oauth_service import GoogleOAuthService

logger = logging.getLogger('api')


class CSRFTokenView(APIView):
    """
    Emite y sincroniza la cookie csrftoken para que el frontend (BFF)
    pueda enviar la cabecera X-CSRFToken en peticiones mutantes (POST/PUT/DELETE).
    """
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        csrf_token = get_token(request)
        return Response({'csrfToken': csrf_token})


class AuthMeView(APIView):
    """
    Verifica el estado de la sesión activa del usuario (BFF).
    Si el usuario tiene una cookie de sesión válida, devuelve su información y perfil.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'authenticated': False, 'user': None})

        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)

        return Response({
            'authenticated': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'auth_provider': profile.auth_provider,
                'google_sub': profile.google_sub,
                'email_verified': profile.email_verified,
            }
        })


class GoogleLoginUrlView(APIView):
    """
    Genera la URL para iniciar el flujo de autenticación SSO con Google.
    Genera state, nonce y PKCE vinculados a la sesión de Django.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        redirect_uri = os.environ.get(
            'GOOGLE_OAUTH_LOGIN_REDIRECT_URI',
            'http://localhost:8000/api/auth/google/callback/'
        )
        try:
            url = GoogleOAuthService.create_login_authorization_url(request.session, redirect_uri)
            return Response({'url': url})
        except Exception as e:
            logger.error(f"Error generando URL de login Google: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GoogleCallbackView(APIView):
    """
    Callback de redirección para Google OIDC SSO.
    Valida state, nonce, PKCE, ID Token contra JWKS oficial de Google,
    identifica al usuario por 'google_sub' y emite una cookie de sesión segura (BFF).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get('code')
        state = request.query_params.get('state', '')
        error = request.query_params.get('error')
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

        if error:
            logger.warning(f"Google OAuth cancelado o con error: {error}")
            return redirect(f"{frontend_url}/?auth_error={error}")

        if not code or not state:
            return HttpResponse("<h3>Parámetros OAuth incompletos.</h3>", status=400)

        # 1. Validar y consumir state de un solo uso
        try:
            nonce, code_verifier = GoogleOAuthService.validate_and_consume_state(
                request.session, state, session_key_prefix='oauth_login'
            )
        except Exception as e:
            logger.error(f"Fallo de validación de OAuth state: {str(e)}")
            return HttpResponse(f"<h3>Error de seguridad OAuth: {str(e)}</h3>", status=400)

        redirect_uri = os.environ.get(
            'GOOGLE_OAUTH_LOGIN_REDIRECT_URI',
            'http://localhost:8000/api/auth/google/callback/'
        )

        # 2. Intercambio de código usando PKCE
        try:
            token_resp = GoogleOAuthService.exchange_code(code, redirect_uri, code_verifier)
            id_token = token_resp.get('id_token')
            if not id_token:
                return HttpResponse("<h3>Google no devolvió ID Token.</h3>", status=400)

            # 3. Validación criptográfica de ID Token (JWKS + nonce + aud + iss)
            payload = GoogleOAuthService.verify_id_token(id_token, expected_nonce=nonce)
            google_sub = payload['sub']
            email = payload.get('email', '')
            name = payload.get('name', '')

            # 4. Resolución de identidad segura usando 'sub' inmutable
            user = None
            profile = UserProfile.objects.filter(google_sub=google_sub).select_related('user').first()

            if profile:
                user = profile.user
            else:
                # Comprobar si ya existe un usuario por email verificado
                existing_user = User.objects.filter(email__iexact=email).first()
                if existing_user:
                    profile, _ = UserProfile.objects.get_or_create(user=existing_user)
                    if profile.google_sub and profile.google_sub != google_sub:
                        return HttpResponse(
                            "<h3>Conflicto de identidad: esta cuenta ya está vinculada a otro perfil de Google.</h3>",
                            status=409
                        )
                    profile.google_sub = google_sub
                    profile.auth_provider = 'google'
                    profile.email_verified = True
                    profile.save()
                    user = existing_user
                else:
                    # Crear nuevo usuario
                    base_username = email.split('@')[0] if email else f"google_{google_sub[:8]}"
                    username = base_username
                    counter = 1
                    while User.objects.filter(username=username).exists():
                        username = f"{base_username}_{counter}"
                        counter += 1

                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        first_name=name[:30] if name else ''
                    )
                    UserProfile.objects.create(
                        user=user,
                        google_sub=google_sub,
                        auth_provider='google',
                        email_verified=True
                    )

            # 5. Iniciar sesión Django (rota la sesión para prevenir Session Fixation)
            login(request, user)

            # 6. Registrar en AuditLog
            ip = request.META.get('REMOTE_ADDR')
            AuditLog.objects.create(
                user=user,
                action='login',
                resource='google_oidc_sso',
                ip_address=ip,
                details={'auth_provider': 'google', 'sub': google_sub}
            )

            # 7. Redirigir al frontend autenticado
            return redirect(f"{frontend_url}/?login_success=true")

        except Exception as e:
            logger.error(f"Error procesando Google Callback: {str(e)}", exc_info=True)
            return HttpResponse(f"<h3>Error de autenticación: {str(e)}</h3>", status=400)


class LogoutView(APIView):
    """
    Cierra la sesión del usuario (BFF), destruye la sesión server-side
    e invalida la cookie del navegador.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if request.user.is_authenticated:
            user = request.user
            ip = request.META.get('REMOTE_ADDR')
            AuditLog.objects.create(
                user=user,
                action='modify',
                resource='session_logout',
                ip_address=ip,
                details={'reason': 'user_logout'}
            )
        logout(request)
        return Response({'status': 'logged_out'})


class SessionLoginView(APIView):
    """
    Inicio de sesión local con usuario/email y contraseña usando cookies de sesión HttpOnly (BFF).
    Rota la sesión para prevenir Session Fixation.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({'error': 'Usuario y contraseña requeridos'}, status=status.HTTP_400_BAD_REQUEST)

        # Autenticar por username o email
        user = authenticate(request, username=username, password=password)
        if not user and '@' in username:
            try:
                user_obj = User.objects.get(email__iexact=username)
                user = authenticate(request, username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None

        if not user:
            return Response({'error': 'Credenciales incorrectas'}, status=status.HTTP_401_UNAUTHORIZED)

        # Iniciar sesión rotando la clave
        login(request, user)
        profile, _ = UserProfile.objects.get_or_create(user=user)

        # Registrar en AuditLog
        ip = request.META.get('REMOTE_ADDR')
        AuditLog.objects.create(
            user=user,
            action='login',
            resource='session_login',
            ip_address=ip,
            details={'auth_provider': profile.auth_provider}
        )

        return Response({
            'status': 'success',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'auth_provider': profile.auth_provider,
            }
        })
