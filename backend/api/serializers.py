from rest_framework import serializers
from .models import Account, Category, Transaction, ImportBatch, ClassificationRule, Alert, Budget

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = '__all__'

class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    account_name = serializers.ReadOnlyField(source='account.name')

    class Meta:
        model = Transaction
        fields = '__all__'

class ImportBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportBatch
        fields = '__all__'
        read_only_fields = ['user', 'uploaded_at', 'status']

class ClassificationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassificationRule
        fields = '__all__'

class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ['id', 'type', 'title', 'message', 'icon', 'is_read', 'is_dismissed', 'created_at', 'related_data']
        read_only_fields = ['user', 'created_at']


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_color = serializers.ReadOnlyField(source='category.color')
    
    class Meta:
        model = Budget
        fields = ['id', 'category', 'category_name', 'category_color', 'amount', 'month', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']
