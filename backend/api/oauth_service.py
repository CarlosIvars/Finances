import os
import secrets
import hashlib
import base64
import time
import logging
import requests
import jwt
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError

logger = logging.getLogger('api')

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"

STATE_TTL_SECONDS = 600  # 10 minutos de validez para el state


class GoogleOAuthService:
    """
    Servicio de autenticación e integración con Google según RFC 9700 (OAuth 2.0 Security BCP)
    y OIDC Core 1.0:
    - PKCE (code_verifier / code_challenge S256)
    - Anti-CSRF state vinculado a la sesión del usuario (un solo uso, TTL 10 min)
    - OIDC nonce vinculado a la sesión
    - Validación criptográfica de ID Token (JWKS, issuer, audience, exp, iat, nonce)
    - Identificador inmutable 'sub' como clave primaria de identidad
    """

    @staticmethod
    def get_client_id() -> str:
        client_id = os.environ.get('GOOGLE_CLIENT_ID', getattr(settings, 'GOOGLE_CLIENT_ID', ''))
        return client_id

    @staticmethod
    def get_client_secret() -> str:
        secret = os.environ.get('GOOGLE_CLIENT_SECRET', getattr(settings, 'GOOGLE_CLIENT_SECRET', ''))
        return secret

    @classmethod
    def generate_pkce(cls):
        """Genera un code_verifier y su code_challenge (S256)."""
        verifier = secrets.token_urlsafe(64)
        digest = hashlib.sha256(verifier.encode('ascii')).digest()
        challenge = base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')
        return verifier, challenge

    @classmethod
    def create_login_authorization_url(cls, session, redirect_uri: str) -> str:
        """
        Inicia el flujo de autenticación SSO OIDC para el usuario.
        Almacena state, nonce y code_verifier en la sesión del backend.
        Solo solicita scopes de identidad mínimos (Least Privilege).
        """
        client_id = cls.get_client_id()
        if not client_id:
            raise ValueError("GOOGLE_CLIENT_ID no está configurado en las variables de entorno.")

        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)
        code_verifier, code_challenge = cls.generate_pkce()

        # Guardar en sesión server-side (anti-CSRF y single-use)
        session['oauth_login_state'] = state
        session['oauth_login_nonce'] = nonce
        session['oauth_login_verifier'] = code_verifier
        session['oauth_login_created_at'] = time.time()
        session['oauth_login_used'] = False
        session.modified = True

        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': 'openid email profile',
            'state': state,
            'nonce': nonce,
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256',
            'access_type': 'online',
            'prompt': 'select_account',
        }
        query_string = "&".join(f"{k}={requests.utils.quote(str(v))}" for k, v in params.items())
        return f"{GOOGLE_AUTH_URL}?{query_string}"

    @classmethod
    def validate_and_consume_state(cls, session, received_state: str, session_key_prefix: str = 'oauth_login') -> tuple:
        """
        Valida que el state recibido coincida exactamente, no haya expirado y no haya sido usado.
        Devuelve (nonce, code_verifier) y elimina inmediatamente el state para que sea de un solo uso.
        """
        state_key = f"{session_key_prefix}_state"
        nonce_key = f"{session_key_prefix}_nonce"
        verifier_key = f"{session_key_prefix}_verifier"
        created_key = f"{session_key_prefix}_created_at"
        used_key = f"{session_key_prefix}_used"

        expected_state = session.get(state_key)
        created_at = session.get(created_key, 0)
        is_used = session.get(used_key, True)
        nonce = session.get(nonce_key)
        code_verifier = session.get(verifier_key)

        # Inmediatamente marcar como usado / limpiar para evitar reuso
        session[used_key] = True
        session.pop(state_key, None)
        session.pop(created_key, None)
        session.modified = True

        if not expected_state or not received_state:
            try:
                from api.security_monitoring import SecurityMonitor
                SecurityMonitor.record_oauth_anomaly('missing_state')
            except Exception:
                pass
            raise ValidationError("OAuth state ausente en la sesión o en la petición.")

        if not secrets.compare_digest(expected_state, received_state):
            try:
                from api.security_monitoring import SecurityMonitor
                SecurityMonitor.record_oauth_anomaly('state_mismatch')
            except Exception:
                pass
            raise ValidationError("OAuth state inválido (posible ataque CSRF).")

        if is_used:
            try:
                from api.security_monitoring import SecurityMonitor
                SecurityMonitor.record_oauth_anomaly('state_replay_attempt')
            except Exception:
                pass
            raise ValidationError("OAuth state ya ha sido utilizado (protección anti-replay).")

        now = time.time()
        if now - created_at > STATE_TTL_SECONDS:
            try:
                from api.security_monitoring import SecurityMonitor
                SecurityMonitor.record_oauth_anomaly('state_expired')
            except Exception:
                pass
            raise ValidationError("OAuth state ha expirado (límite 10 minutos).")

        return nonce, code_verifier

    @classmethod
    def exchange_code(cls, code: str, redirect_uri: str, code_verifier: str) -> dict:
        """Intercambia el código de autorización por tokens en el endpoint de Google usando PKCE."""
        client_id = cls.get_client_id()
        client_secret = cls.get_client_secret()

        payload = {
            'code': code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
        }
        if code_verifier:
            payload['code_verifier'] = code_verifier

        resp = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=10)
        if resp.status_code != 200:
            logger.error(f"Error al intercambiar código con Google: {resp.status_code} - {resp.text}")
            raise ValidationError(f"Error de Google al intercambiar el código: {resp.text}")

        return resp.json()

    @classmethod
    def verify_id_token(cls, id_token: str, expected_nonce: str) -> dict:
        """
        Valida criptográficamente el ID Token de Google:
        - Descarga las claves públicas oficiales (JWKS).
        - Verifica la firma RS256.
        - Valida issuer ('https://accounts.google.com' o 'accounts.google.com').
        - Valida audience (GOOGLE_CLIENT_ID).
        - Valida expiración (exp) y fecha de emisión (iat).
        - Valida correspondencia con el 'nonce' de la sesión.
        - Exige 'email_verified' == True.
        """
        client_id = cls.get_client_id()
        if not id_token:
            raise ValidationError("ID Token no presente en la respuesta de Google.")

        try:
            jwks_client = jwt.PyJWKClient(GOOGLE_JWKS_URL)
            signing_key = jwks_client.get_signing_key_from_jwt(id_token)

            decoded = jwt.decode(
                id_token,
                signing_key.key,
                algorithms=["RS256"],
                audience=client_id,
                issuer=["https://accounts.google.com", "accounts.google.com"],
                options={"verify_exp": True, "verify_iat": True}
            )
        except Exception as e:
            logger.error(f"Fallo en la validación criptográfica del ID Token: {str(e)}")
            raise ValidationError(f"Fallo de validación de firma o integridad del ID Token: {str(e)}")

        # Validar nonce
        if expected_nonce:
            token_nonce = decoded.get('nonce')
            if not token_nonce or not secrets.compare_digest(token_nonce, expected_nonce):
                try:
                    from api.security_monitoring import SecurityMonitor
                    SecurityMonitor.record_oauth_anomaly('nonce_mismatch')
                except Exception:
                    pass
                raise ValidationError("El nonce del ID Token no coincide con la transacción.")

        # Validar sub
        sub = decoded.get('sub')
        if not sub:
            raise ValidationError("El ID Token no contiene un 'sub' válido.")

        # Validar email_verified
        if not decoded.get('email_verified'):
            raise ValidationError("La cuenta de Google no tiene el email verificado.")

        return decoded

    @classmethod
    def revoke_token(cls, token: str) -> bool:
        """Revoca un token (access o refresh) ante los servidores de Google."""
        if not token:
            return True
        try:
            resp = requests.post(
                GOOGLE_REVOKE_URL,
                params={'token': token},
                headers={'content-type': 'application/x-www-form-urlencoded'},
                timeout=5
            )
            return resp.status_code == 200
        except Exception as e:
            logger.warning(f"Error al revocar token en Google: {str(e)}")
            return False

