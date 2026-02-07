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
    is_income = models.BooleanField(default=False) # True for Income categories, False for Expense
    
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
    import_batch = models.ForeignKey(ImportBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    
    is_pending = models.BooleanField(default=True, help_text="Requires manual review/categorization")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.date} - {self.description} : {self.amount} ({self.type})"

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
