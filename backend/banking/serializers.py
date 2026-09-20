"""
Serializers para la app banking (Open Banking).
"""
from rest_framework import serializers
from banking.models import BankConnection, BankAccount, BankTransaction, SyncLog


class BankTransactionSerializer(serializers.ModelSerializer):
    """Transacción bancaria obtenida via Open Banking."""

    class Meta:
        model = BankTransaction
        fields = [
            'id', 'external_transaction_id', 'booking_date', 'value_date',
            'amount', 'currency', 'description', 'merchant_name',
            'category_code', 'created_at',
        ]
        read_only_fields = fields


class BankAccountSerializer(serializers.ModelSerializer):
    """Cuenta bancaria conectada via Open Banking."""
    recent_transactions = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = [
            'id', 'external_account_id', 'iban', 'name', 'currency',
            'balance', 'balance_updated_at', 'account_type',
            'created_at', 'updated_at', 'recent_transactions',
        ]
        read_only_fields = fields

    def get_recent_transactions(self, obj) -> list:
        """Últimas 10 transacciones de la cuenta."""
        if not self.context.get('include_transactions', False):
            return []
        txs = obj.bank_transactions.all()[:10]
        return BankTransactionSerializer(txs, many=True).data


class BankAccountDetailSerializer(BankAccountSerializer):
    """Cuenta bancaria con transacciones incluidas."""

    class Meta(BankAccountSerializer.Meta):
        pass

    def get_recent_transactions(self, obj) -> list:
        txs = obj.bank_transactions.all()[:50]
        return BankTransactionSerializer(txs, many=True).data


class SyncLogSerializer(serializers.ModelSerializer):
    """Log de sincronización bancaria."""

    class Meta:
        model = SyncLog
        fields = [
            'id', 'sync_type', 'status', 'accounts_synced',
            'transactions_added', 'transactions_updated',
            'error_message', 'started_at', 'completed_at',
        ]
        read_only_fields = fields


class BankConnectionSerializer(serializers.ModelSerializer):
    """Conexión bancaria (cabecera)."""
    accounts = BankAccountSerializer(
        source='bank_accounts', many=True, read_only=True,
    )
    is_consent_valid = serializers.SerializerMethodField()

    class Meta:
        model = BankConnection
        fields = [
            'id', 'provider', 'institution_id', 'institution_name',
            'status', 'consent_expires_at', 'last_synced_at',
            'is_consent_valid', 'accounts', 'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_is_consent_valid(self, obj) -> bool:
        return obj.is_consent_valid()


class BankConnectionDetailSerializer(BankConnectionSerializer):
    """Conexión bancaria con más detalle."""
    accounts = BankAccountDetailSerializer(
        source='bank_accounts', many=True, read_only=True,
    )
    recent_syncs = serializers.SerializerMethodField()

    class Meta(BankConnectionSerializer.Meta):
        fields = BankConnectionSerializer.Meta.fields + ['recent_syncs']

    def get_recent_syncs(self, obj) -> list:
        syncs = obj.sync_logs.all()[:5]
        return SyncLogSerializer(syncs, many=True).data


class CreateConnectionSerializer(serializers.Serializer):
    """Input para crear una nueva conexión bancaria."""
    institution_id = serializers.CharField(max_length=100)
    redirect_url = serializers.URLField(
        required=False,
        help_text="URL de callback tras autorización. Defaults to BANKING_CALLBACK_URL.",
    )


class InstitutionSerializer(serializers.Serializer):
    """Institución bancaria disponible."""
    id = serializers.CharField()
    name = serializers.CharField()
    logo_url = serializers.CharField(allow_blank=True)
    country = serializers.CharField()

