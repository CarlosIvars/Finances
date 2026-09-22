from django.db import models
from django.contrib.auth.models import User
from banking.encryption import encrypt_token, decrypt_token


class GmailAccount(models.Model):
    """Cuenta de Gmail conectada mediante OAuth2 para escaneo de facturas."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='gmail_account')
    email = models.EmailField(max_length=255, blank=True)
    access_token_encrypted = models.BinaryField(null=True, blank=True)
    refresh_token_encrypted = models.BinaryField(null=True, blank=True)
    token_expiry = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    sync_query = models.CharField(
        max_length=255,
        default='has:attachment (filename:pdf OR filename:png OR filename:jpg OR filename:jpeg)',
        help_text="Filtro de búsqueda de mensajes en Gmail"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def set_access_token(self, token: str):
        self.access_token_encrypted = encrypt_token(token) if token else None

    def get_access_token(self) -> str:
        return decrypt_token(self.access_token_encrypted) if self.access_token_encrypted else ""

    def set_refresh_token(self, token: str):
        self.refresh_token_encrypted = encrypt_token(token) if token else None

    def get_refresh_token(self) -> str:
        return decrypt_token(self.refresh_token_encrypted) if self.refresh_token_encrypted else ""

    def __str__(self):
        return f"Gmail: {self.email or self.user.username} ({'Activo' if self.is_active else 'Inactivo'})"


def document_upload_path(instance, filename):
    """Guarda documentos en media/documents/{user_id}/{year}/{month}/{safe_uuid_name}"""
    from datetime import date
    from api.security_utils import generate_safe_storage_name
    today = date.today()
    user_id = instance.user_id if instance.user_id else 'common'
    safe_name = generate_safe_storage_name(filename)
    return f"documents/{user_id}/{today.year}/{today.month:02d}/{safe_name}"


class Document(models.Model):
    """Archivo adjunto (factura, recibo, justificante) almacenado en el sistema."""
    STATUS_CHOICES = [
        ('unmatched', 'Sin vincular'),
        ('suggested', 'Sugerencia pendiente'),
        ('auto_matched', 'Vinculación directa automática'),
        ('confirmed', 'Confirmado manual'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    transaction = models.ForeignKey(
        'api.Transaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documents',
        help_text="Transacción vinculada"
    )
    suggested_transaction = models.ForeignKey(
        'api.Transaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='suggested_documents',
        help_text="Transacción propuesta para coincidencia pendiente de confirmación"
    )

    file = models.FileField(upload_to=document_upload_path, null=True, blank=True)
    storage_path = models.CharField(max_length=500, blank=True, help_text="Ruta en storage local o bucket GCS")
    file_name = models.CharField(max_length=255)
    file_size = models.IntegerField(default=0, help_text="Tamaño en bytes")
    mime_type = models.CharField(max_length=100, default='application/pdf')
    file_hash = models.CharField(max_length=64, db_index=True, blank=True, help_text="SHA-256 para evitar duplicados")

    # Metadatos del correo origen (Gmail)
    gmail_message_id = models.CharField(max_length=100, blank=True, db_index=True)
    gmail_thread_id = models.CharField(max_length=100, blank=True)
    gmail_web_link = models.URLField(max_length=500, blank=True, help_text="Enlace directo a Gmail web")
    email_subject = models.CharField(max_length=300, blank=True)
    email_sender = models.CharField(max_length=255, blank=True)
    email_date = models.DateTimeField(null=True, blank=True)

    # Detección de importe o datos adicionales
    amount_hint = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='unmatched')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.file_name} ({self.get_status_display()})"

