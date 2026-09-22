import os
import base64
import hashlib
import logging
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger('api')

VERSION_PREFIX = b"v1$"
NONCE_LENGTH = 12  # Standard 96-bit nonce for AES-GCM


def _derive_256_key(key_str: str) -> bytes:
    """Deriva una clave de 256 bits (32 bytes) segura a partir de la cadena de configuración."""
    if not key_str:
        raise ValueError("BANKING_ENCRYPTION_KEY is not set.")
    # Si la clave ya es base64 válida de 32 bytes (como las de Fernet)
    try:
        decoded = base64.urlsafe_b64decode(key_str)
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass
    # Derivación determinista con SHA-256
    return hashlib.sha256(key_str.encode('utf-8')).digest()


def _get_aesgcm(custom_key: str = None) -> AESGCM:
    key_str = custom_key or os.environ.get('BANKING_ENCRYPTION_KEY', getattr(settings, 'BANKING_ENCRYPTION_KEY', None))
    if not key_str:
        # Fallback de desarrollo con SECRET_KEY
        key_str = getattr(settings, 'SECRET_KEY', 'default-dev-secret-key-32bytes-min!')
    derived_key = _derive_256_key(key_str)
    return AESGCM(derived_key)


def generate_key() -> str:
    """Genera una nueva clave de 256 bits codificada en urlsafe base64."""
    key = AESGCM.generate_key(bit_length=256)
    return base64.urlsafe_b64encode(key).decode('utf-8')


def encrypt_token(plaintext: str, custom_key: str = None) -> bytes:
    """Encripta texto plano a bytes usando AES-256-GCM con prefijo de versión y nonce aleatorio."""
    if not plaintext:
        return b''
    aesgcm = _get_aesgcm(custom_key)
    nonce = os.urandom(NONCE_LENGTH)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
    return VERSION_PREFIX + nonce + ciphertext


def decrypt_token(encrypted: bytes, custom_key: str = None) -> str:
    """
    Desencripta bytes a texto plano.
    Soporta formato actual AES-256-GCM (v1$) y fallback a Fernet (AES-128-CBC) para compatibilidad.
    """
    if not encrypted:
        return ""

    raw = bytes(encrypted)

    # 1. Formato moderno AES-256-GCM con versionado
    if raw.startswith(VERSION_PREFIX):
        payload = raw[len(VERSION_PREFIX):]
        if len(payload) < NONCE_LENGTH + 16:
            logger.error("Cifrado truncado o corrupto.")
            return ""
        nonce = payload[:NONCE_LENGTH]
        ciphertext = payload[NONCE_LENGTH:]
        aesgcm = _get_aesgcm(custom_key)
        try:
            decrypted = aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted.decode('utf-8')
        except Exception as e:
            logger.error(f"Fallo al desencriptar con AES-256-GCM: {str(e)}")
            return ""

    # 2. Fallback retrocompatible para registros antiguos (Fernet / CBC)
    key_str = custom_key or os.environ.get('BANKING_ENCRYPTION_KEY', getattr(settings, 'BANKING_ENCRYPTION_KEY', None))
    if key_str:
        try:
            f = Fernet(key_str.encode('utf-8') if isinstance(key_str, str) else key_str)
            return f.decrypt(raw).decode('utf-8')
        except (InvalidToken, Exception):
            pass

    logger.warning("No se pudo desencriptar el token con ninguno de los métodos soportados.")
    return ""


def rotate_encrypted_token(encrypted: bytes, old_key: str, new_key: str) -> bytes:
    """
    Desencripta con la clave anterior (soporta tanto Fernet como AES-GCM)
    y re-encripta con la nueva clave AES-256-GCM (v1$).
    """
    if not encrypted:
        return b''
    plaintext = decrypt_token(encrypted, custom_key=old_key)
    if not plaintext:
        raise ValueError("Fallo de desencriptación con la clave anterior durante la rotación.")
    return encrypt_token(plaintext, custom_key=new_key)
