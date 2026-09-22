from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Account(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='accounts')
    name = models.CharField(max_length=100)
    bank_name = models.CharField(max_length=100, blank=True)
    initial_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='EUR')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.currency})"

class Category(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    color = models.CharField(max_length=7, default='#cccccc') # Hex color
    icon = models.CharField(max_length=40, default='credit_card')
    is_income = models.BooleanField(default=False) # True for Income categories, False for Expense
    aeat_code = models.CharField(max_length=50, blank=True, null=True, help_text="Código casilla AEAT (ej. DONACION_0722, ALQUILER_0102)")
    tax_deductible = models.BooleanField(default=False, help_text="Indica si esta categoría desgrava o deduce en el IRPF")
    
    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name

class ImportBatch(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='import_batches')
    file = models.FileField(upload_to='uploads/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='pending') # pending, processed, error

    def __str__(self):
        return f"{self.file.name} - {self.uploaded_at.strftime('%Y-%m-%d')}"

class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('income', 'Ingresos'),
        ('expense', 'Gastos'),
        ('transfer', 'Transferencia'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='transactions')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    
    date = models.DateField()
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    
    raw_data = models.TextField(blank=True, help_text="Original raw description from bank")
    metadata = models.JSONField(default=dict, blank=True, help_text="Structured notification metadata (card, bank, tags, etc.)")
    import_batch = models.ForeignKey(ImportBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    
    is_pending = models.BooleanField(default=True, help_text="Requires manual review/categorization")
    client_id = models.CharField(max_length=64, unique=True, null=True, blank=True, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    # IRPF / Fiscal fields
    tax_year = models.IntegerField(null=True, blank=True, help_text="Ejercicio fiscal (ej. 2025). Si está vacío se asume el año de la fecha.")
    is_tax_deductible = models.BooleanField(default=False, help_text="Marcado explícito como deducible en IRPF")
    tax_tags = models.JSONField(default=list, blank=True, help_text="Etiquetas fiscales (ej. ['Renta2025', 'DonacionCruzRoja'])")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def effective_tax_year(self):
        return self.tax_year if self.tax_year else (self.date.year if self.date else None)

    def __str__(self):
        return f"{self.date} - {self.description} : {self.amount} ({self.type})"


class TaxFilterPreset(models.Model):
    """Presets de filtros fiscales para la Declaración de la Renta (AEAT y personalizados)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tax_presets', null=True, blank=True)
    name = models.CharField(max_length=150)
    aeat_box = models.CharField(max_length=150, blank=True, help_text="Referencia a la casilla AEAT (ej. Casilla 722)")
    filters = models.JSONField(default=dict, blank=True, help_text="Configuración de filtros JSON")
    is_system_preset = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_system_preset', 'name']

    def __str__(self):
        return f"{self.name} ({self.aeat_box})" if self.aeat_box else self.name


class ClassificationRule(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rules')
    keyword = models.CharField(max_length=100, help_text="Keyword to search in description")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='rules')
    
    def __str__(self):
        return f"If contains '{self.keyword}' -> {self.category.name}"


class Alert(models.Model):
    """Sistema de alertas y notificaciones"""
    ALERT_TYPES = [
        ('insight', '💡 Insight IA'),
        ('reminder', '📅 Recordatorio'),
        ('anomaly', '⚠️ Anomalía'),
        ('goal', '🎯 Meta'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='alerts')
    type = models.CharField(max_length=20, choices=ALERT_TYPES, default='insight')
    title = models.CharField(max_length=150)
    message = models.TextField()
    icon = models.CharField(max_length=10, default='💡')
    is_read = models.BooleanField(default=False)
    is_dismissed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # JSON field for related transactions/filters
    # Format: {"transaction_ids": [1,2,3], "category_id": 5, "filter_type": "anomaly"}
    related_data = models.JSONField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.icon} {self.title}"


class Budget(models.Model):
    """Presupuesto mensual por categoría"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='budgets')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='budgets')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    month = models.DateField(help_text="Primer día del mes (ej: 2026-02-01)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'category', 'month']
        ordering = ['category__name']
    
    def __str__(self):
        return f"{self.category.name}: {self.amount}€ ({self.month.strftime('%b %Y')})"


class LLMPrompt(models.Model):
    """Prompts editables para el sistema de IA"""
    PROMPT_TYPES = [
        ('insights_system', 'Insights - System Prompt'),
        ('insights_user', 'Insights - User Prompt'),
        ('budget_advice_system', 'Budget Advice - System Prompt'),
        ('budget_advice_user', 'Budget Advice - User Prompt'),
        ('anomaly_detection', 'Anomaly Detection Prompt'),
    ]
    
    name = models.CharField(max_length=50, unique=True, choices=PROMPT_TYPES)
    content = models.TextField()
    description = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "LLM Prompt"
        verbose_name_plural = "LLM Prompts"
    
    def __str__(self):
        return f"{self.get_name_display()}"
    
    @classmethod
    def get_prompt(cls, name: str, default: str = "") -> str:
        """Obtiene el contenido del prompt o devuelve el default"""
        try:
            prompt = cls.objects.get(name=name, is_active=True)
            return prompt.content
        except cls.DoesNotExist:
            return default


class UserConsent(models.Model):
    """
    RGPD Art. 7: Registro auditable de consentimientos del usuario.
    Mantiene historial completo (nunca borrar, es prueba legal).
    """
    CONSENT_TYPES = [
        ('terms_accepted', 'Términos y condiciones'),
        ('ai_processing', 'Análisis con IA'),
        ('external_ai', 'Procesamiento por IA externa'),
        ('analytics', 'Analytics de uso'),
        ('open_banking', 'Acceso a datos bancarios (Open Banking)'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='consents')
    consent_type = models.CharField(max_length=50, choices=CONSENT_TYPES)
    granted = models.BooleanField()
    timestamp = models.DateTimeField(auto_now_add=True)
    version = models.CharField(max_length=10, default='1.0', help_text="Versión de la política de privacidad")

    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Consentimiento"
        verbose_name_plural = "Consentimientos"

    def __str__(self):
        status = "✅ concedido" if self.granted else "❌ revocado"
        return f"{self.get_consent_type_display()} — {status} ({self.timestamp})"

    @classmethod
    def has_consent(cls, user, consent_type: str) -> bool:
        """Devuelve si el usuario tiene consentimiento activo para un tipo dado."""
        latest = cls.objects.filter(
            user=user, consent_type=consent_type
        ).order_by('-timestamp').first()
        return latest.granted if latest else False

    @classmethod
    def get_all_consents(cls, user) -> dict:
        """Devuelve estado actual de todos los consentimientos del usuario."""
        result = {}
        for consent_type, _label in cls.CONSENT_TYPES:
            result[consent_type] = cls.has_consent(user, consent_type)
        return result


class AuditLog(models.Model):
    """
    RGPD: Registro de auditoría para accesos y operaciones sobre datos personales.
    No almacena datos sensibles, solo metadata.
    """
    ACTION_TYPES = [
        ('view', 'Ver datos'),
        ('export', 'Exportar datos'),
        ('delete', 'Eliminar datos'),
        ('modify', 'Modificar datos'),
        ('consent_change', 'Cambio de consentimiento'),
        ('login', 'Inicio de sesión'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=50, choices=ACTION_TYPES)
    resource = models.CharField(max_length=100, help_text="Recurso accedido (ej: 'transactions', 'user_data')")
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    details = models.JSONField(null=True, blank=True, help_text="Metadata no sensible sobre la acción")
    previous_hash = models.CharField(max_length=64, blank=True, default='', help_text="Hash SHA-256 del registro anterior")
    event_hash = models.CharField(max_length=64, blank=True, default='', db_index=True, help_text="Hash SHA-256 de este evento")

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]
        verbose_name = "Registro de auditoría"
        verbose_name_plural = "Registros de auditoría"

    def save(self, *args, **kwargs):
        from django.core.exceptions import PermissionDenied
        import hashlib
        import json

        if self.pk:
            raise PermissionDenied("Los registros de auditoría son inmutables (append-only). No se permiten modificaciones.")

        last_log = AuditLog.objects.order_by('-id').first()
        self.previous_hash = last_log.event_hash if (last_log and last_log.event_hash) else "0" * 64

        details_str = json.dumps(self.details, sort_keys=True) if self.details else ""
        raw_data = f"{self.previous_hash}:{self.user_id}:{self.action}:{self.resource}:{details_str}"
        self.event_hash = hashlib.sha256(raw_data.encode('utf-8')).hexdigest()

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        from django.core.exceptions import PermissionDenied
        raise PermissionDenied("Los registros de auditoría no pueden ser eliminados (append-only).")

    @classmethod
    def verify_chain_integrity(cls) -> tuple:
        """
        Verifica criptográficamente que la cadena de hashes de auditoría no ha sido manipulada.
        Retorna (is_valid: bool, tampered_id: Optional[int]).
        """
        logs = cls.objects.order_by('id')
        prev_hash = "0" * 64
        import hashlib
        import json

        for log in logs:
            if log.previous_hash != prev_hash:
                return False, log.id
            details_str = json.dumps(log.details, sort_keys=True) if log.details else ""
            raw_data = f"{log.previous_hash}:{log.user_id}:{log.action}:{log.resource}:{details_str}"
            expected_hash = hashlib.sha256(raw_data.encode('utf-8')).hexdigest()
            if log.event_hash != expected_hash:
                return False, log.id
            prev_hash = log.event_hash

        return True, None

    def __str__(self):
        return f"[{self.timestamp}] {self.user} — {self.get_action_display()} → {self.resource}"


class UserProfile(models.Model):
    """
    Extensión del usuario para identidad federada OIDC y atributos de seguridad.
    El campo google_sub es el identificador unívoco e inmutable provisto por Google.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    auth_provider = models.CharField(max_length=20, default='local')  # 'local', 'google'
    email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Perfil de usuario"
        verbose_name_plural = "Perfiles de usuario"

    def __str__(self):
        return f"Profile({self.user.username}, provider={self.auth_provider}, sub={self.google_sub})"
