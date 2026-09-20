from django.contrib import admin
from .models import BankConnection, BankAccount, BankTransaction, SyncLog

@admin.register(BankConnection)
class BankConnectionAdmin(admin.ModelAdmin):
    list_display = ('institution_name', 'user', 'provider', 'status', 'created_at', 'last_synced_at')
    list_filter = ('provider', 'status', 'created_at')
    search_fields = ('institution_name', 'user__username', 'institution_id')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'bank_connection', 'account_type', 'currency', 'balance', 'iban')
    list_filter = ('account_type', 'currency', 'created_at')
    search_fields = ('name', 'iban', 'external_account_id', 'bank_connection__institution_name')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(BankTransaction)
class BankTransactionAdmin(admin.ModelAdmin):
    list_display = ('description', 'bank_account', 'amount', 'currency', 'booking_date')
    list_filter = ('currency', 'booking_date', 'created_at')
    search_fields = ('description', 'merchant_name', 'external_transaction_id')
    readonly_fields = ('created_at',)

@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ('bank_connection', 'sync_type', 'status', 'started_at', 'completed_at')
    list_filter = ('sync_type', 'status', 'started_at')
    search_fields = ('bank_connection__institution_name', 'error_message')
    readonly_fields = ('started_at',)
