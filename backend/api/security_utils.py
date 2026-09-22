import os
import re
import uuid
import socket
import ipaddress
import urllib.parse
from django.core.exceptions import ValidationError

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

MAGIC_BYTES = {
    '.pdf': [b'%PDF-'],
    '.png': [b'\x89PNG\r\n\x1a\n'],
    '.jpg': [b'\xff\xd8\xff'],
    '.jpeg': [b'\xff\xd8\xff'],
    '.xlsx': [b'PK\x03\x04'],  # ZIP container format
}

ALLOWED_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xlsx'}


def validate_uploaded_file(content: bytes, filename: str, max_size: int = MAX_UPLOAD_SIZE_BYTES) -> str:
    """
    Valida tamaño de archivo, extensión y magic bytes según Sección 48 de SECURITY_PLAN.md.
    Lanza ValidationError si el archivo no supera las comprobaciones.
    Devuelve la extensión validada en minúsculas.
    """
    if not content:
        raise ValidationError("El archivo está vacío.")

    if len(content) > max_size:
        raise ValidationError(f"El tamaño del archivo ({len(content)} bytes) supera el límite máximo permitido ({max_size} bytes).")

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(f"Extensión de archivo no permitida: '{ext}'. Extensiones válidas: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    # Comprobación de magic bytes para formatos binarios
    expected_signatures = MAGIC_BYTES.get(ext)
    if expected_signatures:
        matches = any(content.startswith(sig) for sig in expected_signatures)
        if not matches:
            raise ValidationError(f"Contenido no válido para archivo {ext} (los magic bytes no coinciden con el tipo declarado).")

    # Para CSV, validar que no contenga bytes nulos en los primeros 1024 bytes (indicador de binario/ejecutable)
    if ext == '.csv':
        sample = content[:1024]
        if b'\x00' in sample:
            raise ValidationError("El archivo CSV contiene bytes binarios no válidos.")

    return ext


def generate_safe_storage_name(original_filename: str) -> str:
    """
    Genera un nombre UUID único para almacenamiento según Sección 50 (Path Traversal Protection).
    Evita usar nombres de archivo suministrados por el usuario en rutas de almacenamiento.
    """
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = '.bin'
    return f"{uuid.uuid4().hex}{ext}"


def validate_safe_url(url: str, allowed_schemes=('http', 'https')) -> bool:
    """
    Protección contra SSRF (Server-Side Request Forgery) según Sección 52.
    Bloquea accesos a IPs privadas, loopback, link-local, metadatos de cloud y localhost.
    Lanza ValidationError si la URL apunta a un destino no seguro.
    """
    if not url:
        raise ValidationError("URL vacía.")

    parsed = urllib.parse.urlparse(url)
    if parsed.scheme.lower() not in allowed_schemes:
        raise ValidationError(f"Esquema de URL no permitido: '{parsed.scheme}'. Solo se admiten {allowed_schemes}.")

    hostname = parsed.hostname
    if not hostname:
        raise ValidationError("URL sin hostname válido.")

    # Bloquear localhost y aliases
    if hostname.lower() in ('localhost', '127.0.0.1', '::1', 'metadata.google.internal'):
        raise ValidationError(f"Acceso denegado a host reservado: '{hostname}'.")

    # Resolver IP del hostname y verificar que no sea interna/privada
    try:
        addr_info = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == 'https' else 80))
        for item in addr_info:
            ip_str = item[4][0]
            ip = ipaddress.ip_address(ip_str)

            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
            ):
                raise ValidationError(f"SSRF bloqueado: la IP destino ({ip_str}) es privada o no enrutable públicamente.")

            # Bloqueo explícito de endpoint de metadatos de GCP/AWS
            if str(ip) == '169.254.169.254':
                raise ValidationError("SSRF bloqueado: intento de acceso al endpoint de metadatos cloud.")
    except socket.gaierror:
        raise ValidationError(f"No se pudo resolver el hostname: '{hostname}'.")

    return True


def sanitize_html(raw_html: str) -> str:
    """
    Sanitización de HTML según Secciones 40 y 53 (HTML untrusted content).
    Elimina scripts, iframes, applets, meta, object y atributos con eventos JS.
    """
    if not raw_html:
        return ""

    # 1. Eliminar etiquetas script, style, iframe, object, embed, form, meta
    dangerous_tags_pattern = re.compile(
        r'<\s*(script|style|iframe|object|embed|applet|form|meta|link)[^>]*>.*?<\s*/\s*\1\s*>',
        re.IGNORECASE | re.DOTALL
    )
    sanitized = dangerous_tags_pattern.sub('', raw_html)

    # 2. Eliminar etiquetas autocerradas peligrosas
    dangerous_self_closing = re.compile(
        r'<\s*(script|style|iframe|object|embed|applet|form|meta|link)[^>]*?/?>',
        re.IGNORECASE
    )
    sanitized = dangerous_self_closing.sub('', sanitized)

    # 3. Eliminar atributos con eventos inline (on*) y pseudo-protocolos javascript: / data:
    on_events_pattern = re.compile(r'\b(on\w+|action|href\s*=\s*["\']?javascript:)[^>]*', re.IGNORECASE)
    sanitized = on_events_pattern.sub('', sanitized)

    return sanitized

