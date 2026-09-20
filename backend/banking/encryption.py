import os
from cryptography.fernet import Fernet
from django.conf import settings

def _get_fernet() -> Fernet:
    """Obtiene la instancia de Fernet usando la clave configurada."""
    key = os.environ.get('BANKING_ENCRYPTION_KEY', getattr(settings, 'BANKING_ENCRYPTION_KEY', None))
    if not key:
        raise ValueError("BANKING_ENCRYPTION_KEY is not set.")
    return Fernet(key.encode('utf-8'))

def generate_key() -> str:
    """Genera una nueva clave de encriptación."""
    return Fernet.generate_key().decode('utf-8')

def encrypt_token(plaintext: str) -> bytes:
    """Encripta un token de texto plano a bytes."""
    if not plaintext:
        return b''
    f = _get_fernet()
    return f.encrypt(plaintext.encode('utf-8'))

def decrypt_token(encrypted: bytes) -> str:
    """Desencripta bytes a un token de texto plano."""
    if not encrypted:
        return ""
    f = _get_fernet()
    return f.decrypt(encrypted).decode('utf-8')
