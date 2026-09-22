from rest_framework import serializers
from .models import Document, GmailAccount
from .storage import get_storage_manager


class DocumentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    transaction_description = serializers.ReadOnlyField(source='transaction.description')
    transaction_amount = serializers.ReadOnlyField(source='transaction.amount')
    transaction_date = serializers.ReadOnlyField(source='transaction.date')
    suggested_transaction_description = serializers.ReadOnlyField(source='suggested_transaction.description')
    suggested_transaction_amount = serializers.ReadOnlyField(source='suggested_transaction.amount')
    suggested_transaction_date = serializers.ReadOnlyField(source='suggested_transaction.date')

    class Meta:
        model = Document
        fields = [
            'id', 'file_name', 'file_size', 'mime_type', 'file_hash', 'url',
            'gmail_message_id', 'gmail_thread_id', 'gmail_web_link',
            'email_subject', 'email_sender', 'email_date',
            'amount_hint', 'status',
            'transaction', 'transaction_description', 'transaction_amount', 'transaction_date',
            'suggested_transaction', 'suggested_transaction_description', 'suggested_transaction_amount', 'suggested_transaction_date',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at', 'file_hash']

    def get_url(self, obj):
        storage = get_storage_manager()
        return storage.get_url(obj)


class GmailAccountSerializer(serializers.ModelSerializer):
    has_token = serializers.SerializerMethodField()

    class Meta:
        model = GmailAccount
        fields = [
            'id', 'email', 'is_active', 'last_sync_at', 'sync_query',
            'has_token', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']

    def get_has_token(self, obj):
        return bool(obj.access_token_encrypted or obj.refresh_token_encrypted)

