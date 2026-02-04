from django.contrib import admin
from django.utils.html import format_html
from .models import Account, Category, Transaction, ImportBatch, ClassificationRule


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'bank_name', 'user', 'currency', 'initial_balance', 'created_at')
    list_filter = ('currency', 'bank_name', 'user')
    search_fields = ('name', 'bank_name')
    ordering = ('-created_at',)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'color_preview', 'is_income', 'parent', 'user', 'rules_count')
    list_filter = ('is_income', 'user')
    search_fields = ('name',)
    ordering = ('name',)
    
    def color_preview(self, obj):
        return format_html(
            '<span style="background-color: {}; padding: 2px 10px; border-radius: 4px;">&nbsp;</span> {}',
            obj.color, obj.color
        )
    color_preview.short_description = 'Color'
    
    def rules_count(self, obj):
        return obj.rules.count()
    rules_count.short_description = 'Reglas'


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('date', 'short_description', 'amount_display', 'category', 'account', 'is_pending')
    list_filter = ('type', 'category', 'account', 'is_pending', 'date')
    search_fields = ('description', 'raw_data')
    date_hierarchy = 'date'
    ordering = ('-date',)
    list_editable = ('category', 'is_pending')
    list_per_page = 50
    
    fieldsets = (
        ('Información Básica', {
            'fields': ('date', 'description', 'amount', 'type')
        }),
        ('Clasificación', {
            'fields': ('category', 'account', 'is_pending')
        }),
        ('Datos de Importación', {
            'fields': ('raw_data', 'import_batch'),
            'classes': ('collapse',)
        }),
    )
    
    def short_description(self, obj):
        return obj.description[:50] + '...' if len(obj.description) > 50 else obj.description
    short_description.short_description = 'Descripción'
    
    def amount_display(self, obj):
        color = 'green' if obj.type == 'income' else 'red'
        sign = '+' if obj.type == 'income' else '-'
        amount_str = "{:.2f}".format(abs(float(obj.amount)))
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}{} €</span>',
            color, sign, amount_str
        )
    amount_display.short_description = 'Importe'
    amount_display.admin_order_field = 'amount'


@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = ('file', 'user', 'status', 'uploaded_at', 'transactions_count')
    list_filter = ('status', 'user', 'uploaded_at')
    ordering = ('-uploaded_at',)
    readonly_fields = ('uploaded_at',)
    
    def transactions_count(self, obj):
        return obj.transactions.count()
    transactions_count.short_description = 'Transacciones'


@admin.register(ClassificationRule)
class ClassificationRuleAdmin(admin.ModelAdmin):
    list_display = ('keyword', 'category', 'user', 'matches_count')
    list_filter = ('category', 'user')
    search_fields = ('keyword',)
    ordering = ('keyword',)
    
    def matches_count(self, obj):
        # Count how many transactions match this rule
        from django.db.models import Q
        return Transaction.objects.filter(
            user=obj.user,
            description__icontains=obj.keyword
        ).count()
    matches_count.short_description = 'Coincidencias'
