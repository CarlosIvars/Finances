from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from api.models import Account, Transaction
from .encryption import encrypt_token, decrypt_token

class BankConnection(models.Model):
    PROVIDER_CHOICES = [
        ('mock', 'Mock'),
        ('redsys', 'Redsys'),
        ('powens', 'Powens'),
        ('truelayer', 'TrueLayer'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('active', 'Activa'),
        ('expired', 'Expirada'),
        ('error', 'Error'),
        ('revoked', 'Revocada'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bank_connections')
    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES)
    provider_connection_id = models.CharField(max_length=255, blank=True)
    institution_id = models.CharField(max_length=100)
    institution_name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    access_token_encrypted = models.BinaryField(null=True, blank=True)
    refresh_token_encrypted = models.BinaryField(null=True, blank=True)
    
    consent_id = models.CharField(max_length=255, blank=True)
    consent_expires_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True, help_text='Provider-specific data')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
        ]

    def __str__(self) -> str:
        return f"{self.institution_name} - {self.user.username}"

    @property
    def access_token(self) -> str:
        """Obtiene el access_token desencriptado."""
        if not self.access_token_encrypted:
            return ""
        try:
            return decrypt_token(self.access_token_encrypted)
        except Exception:
            return ""

    @access_token.setter
    def access_token(self, value: str) -> None:
        """Establece el access_token encriptado."""
        if value:
            self.access_token_encrypted = encrypt_token(value)
        else:
            self.access_token_encrypted = None

    @property
    def refresh_token(self) -> str:
        """Obtiene el refresh_token desencriptado."""
        if not self.refresh_token_encrypted:
            return ""
        try:
            return decrypt_token(self.refresh_token_encrypted)
        except Exception:
            return ""

    @refresh_token.setter
    def refresh_token(self, value: str) -> None:
        """Establece el refresh_token encriptado."""
        if value:
            self.refresh_token_encrypted = encrypt_token(value)
        else:
            self.refresh_token_encrypted = None

    def is_consent_valid(self) -> bool:
        """Verifica si el consentimiento sigue siendo válido."""
        if self.status != 'active':
            return False
        if self.consent_expires_at and self.consent_expires_at < timezone.now():
            return False
        return True


class BankAccount(models.Model):
    bank_connection = models.ForeignKey(BankConnection, on_delete=models.CASCADE, related_name='bank_accounts')
    account = models.ForeignKey(
        Account, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='bank_account_link',
        help_text='Linked local account'
    )
    external_account_id = models.CharField(max_length=255, unique=True)
    iban = models.CharField(max_length=34, blank=True)
    name = models.CharField(max_length=200)
    currency = models.CharField(max_length=3, default='EUR')
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    balance_updated_at = models.DateTimeField(null=True, blank=True)
    owner_name_encrypted = models.BinaryField(null=True, blank=True)
    account_type = models.CharField(max_length=50, blank=True, help_text='checking, savings, credit_card...')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return f"{self.name} ({self.iban or self.external_account_id})"

    @property
    def owner_name(self) -> str:
        """Obtiene el nombre del titular desencriptado."""
        if not self.owner_name_encrypted:
            return ""
        try:
            return decrypt_token(self.owner_name_encrypted)
        except Exception:
            return ""

    @owner_name.setter
    def owner_name(self, value: str) -> None:
        """Establece el nombre del titular encriptado."""
        if value:
            self.owner_name_encrypted = encrypt_token(value)
        else:
            self.owner_name_encrypted = None


class BankTransaction(models.Model):
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='bank_transactions')
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bank_transaction_link'
    )
    external_transaction_id = models.CharField(max_length=255, db_index=True)
    booking_date = models.DateField()
    value_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default='EUR')
    description = models.CharField(max_length=500)
    merchant_name = models.CharField(max_length=255, blank=True)
    category_code = models.CharField(max_length=50, blank=True, help_text='Category from bank/provider')
    raw_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-booking_date', '-created_at']
        unique_together = ['bank_account', 'external_transaction_id']
        indexes = [
            models.Index(fields=['bank_account', 'booking_date']),
        ]

    def __str__(self) -> str:
        return f"{self.amount} {self.currency} on {self.booking_date} ({self.description[:20]})"


class SyncLog(models.Model):
    SYNC_TYPE_CHOICES = [
        ('manual', 'Manual'),
        ('scheduled', 'Programada'),
        ('webhook', 'Webhook'),
    ]
    STATUS_CHOICES = [
        ('running', 'En curso'),
        ('success', 'Éxito'),
        ('error', 'Error'),
    ]

    bank_connection = models.ForeignKey(BankConnection, on_delete=models.CASCADE, related_name='sync_logs')
    sync_type = models.CharField(max_length=20, choices=SYNC_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='running')
    accounts_synced = models.IntegerField(default=0)
    transactions_added = models.IntegerField(default=0)
    transactions_updated = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self) -> str:
        return f"Sync {self.id} - {self.status} at {self.started_at}"
