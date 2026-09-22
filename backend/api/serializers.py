from rest_framework import serializers
from .models import Account, Category, Transaction, ImportBatch, ClassificationRule, Alert, Budget, TaxFilterPreset


class CategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.ReadOnlyField(source='parent.name')
    subcategories = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'parent', 'parent_name', 'color', 'icon', 'is_income',
            'aeat_code', 'tax_deductible', 'subcategories'
        ]
        # RGPD: 'user' field excluded — never expose user ID to client

    def get_subcategories(self, obj):
        # Obtener hijos directos recursivamente si existen
        children = obj.children.all()
        return CategorySerializer(children, many=True, context=self.context).data

    def validate(self, data):
        """RGPD: Verificar que el parent pertenece al mismo usuario."""
        request = self.context.get('request')
        parent = data.get('parent')
        if parent and request and parent.user != request.user:
            raise serializers.ValidationError({'parent': 'Categoría padre no válida.'})
        return data


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'name', 'bank_name', 'initial_balance', 'currency', 'created_at']


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    parent_category_name = serializers.ReadOnlyField(source='category.parent.name')
    category_color = serializers.ReadOnlyField(source='category.color')
    category_icon = serializers.ReadOnlyField(source='category.icon')
    account_name = serializers.ReadOnlyField(source='account.name')
    effective_tax_year = serializers.ReadOnlyField()
    has_document = serializers.SerializerMethodField()
    documents_count = serializers.SerializerMethodField()
    document_ids = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id', 'client_id', 'date', 'description', 'amount', 'type',
            'category', 'category_name', 'parent_category_name', 'category_color', 'category_icon', 'account', 'account_name',
            'raw_data', 'metadata', 'is_pending', 'is_deleted', 'deleted_at', 'import_batch',
            'tax_year', 'effective_tax_year', 'is_tax_deductible', 'tax_tags',
            'has_document', 'documents_count', 'document_ids',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']

    def get_has_document(self, obj):
        return obj.documents.exists() if hasattr(obj, 'documents') else False

    def get_documents_count(self, obj):
        return obj.documents.count() if hasattr(obj, 'documents') else 0

    def get_document_ids(self, obj):
        return list(obj.documents.values_list('id', flat=True)) if hasattr(obj, 'documents') else []

    def validate_category(self, value):
        if value and value.user != self.context['request'].user:
            raise serializers.ValidationError("Categoría no válida para este usuario.")
        return value


class TaxFilterPresetSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxFilterPreset
        fields = [
            'id', 'name', 'aeat_box', 'filters', 'is_system_preset', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']


class ImportBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportBatch
        fields = ['id', 'file', 'uploaded_at', 'status']


class ClassificationRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_color = serializers.ReadOnlyField(source='category.color')
    
    class Meta:
        model = ClassificationRule
        fields = ['id', 'keyword', 'category', 'category_name', 'category_color']


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ['id', 'type', 'title', 'message', 'icon', 'is_read', 'is_dismissed', 'created_at', 'related_data']
        read_only_fields = ['user', 'created_at']


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_color = serializers.ReadOnlyField(source='category.color')
    category_icon = serializers.ReadOnlyField(source='category.icon')
    
    class Meta:
        model = Budget
        fields = ['id', 'category', 'category_name', 'category_color', 'category_icon', 'amount', 'month', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']


class SyncTransactionSerializer(serializers.ModelSerializer):
    """Serializer for mobile sync - includes all fields needed for offline storage"""
    category_name = serializers.ReadOnlyField(source='category.name')
    parent_category_name = serializers.ReadOnlyField(source='category.parent.name')
    category_color = serializers.ReadOnlyField(source='category.color')
    category_icon = serializers.ReadOnlyField(source='category.icon')
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'client_id', 'date', 'description', 'amount', 'type',
            'category', 'category_name', 'parent_category_name', 'category_color', 'category_icon',
            'raw_data', 'metadata', 'is_pending', 'is_deleted', 'deleted_at', 'created_at', 'updated_at'
        ]


class RegisterSerializer(serializers.Serializer):
    """
    RGPD: Registro de usuario con validación segura y aceptación obligatoria de T&C.
    """
    username = serializers.CharField(min_length=3, max_length=30)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    accept_terms = serializers.BooleanField()

    def validate_username(self, value):
        from django.contrib.auth.models import User
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Este nombre de usuario ya está en uso.')
        return value

    def validate_email(self, value):
        from django.contrib.auth.models import User
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Este email ya está registrado.')
        return value

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('La contraseña debe tener al menos 8 caracteres.')
        if not any(c.isupper() for c in value):
            raise serializers.ValidationError('Debe incluir al menos una mayúscula.')
        if not any(c.islower() for c in value):
            raise serializers.ValidationError('Debe incluir al menos una minúscula.')
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError('Debe incluir al menos un número.')
        return value

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError(
                'Debes aceptar los Términos y Condiciones para registrarte.'
            )
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Las contraseñas no coinciden.'})
        return data

    def create(self, validated_data):
        from django.contrib.auth.models import User
        from .models import Category, UserConsent

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
        )

        # Record T&C acceptance as consent (RGPD proof)
        UserConsent.objects.create(
            user=user,
            consent_type='terms_accepted',
            granted=True,
        )

        # Create default categories for the new user with representative icons
        default_categories = [
            {'name': 'Alimentación', 'color': '#ef4444', 'icon': 'restaurant', 'is_income': False},
            {'name': 'Transporte', 'color': '#f97316', 'icon': 'directions_car', 'is_income': False},
            {'name': 'Hogar', 'color': '#eab308', 'icon': 'home', 'is_income': False},
            {'name': 'Ocio', 'color': '#22c55e', 'icon': 'sports_esports', 'is_income': False},
            {'name': 'Salud', 'color': '#06b6d4', 'icon': 'local_hospital', 'is_income': False},
            {'name': 'Educación', 'color': '#8b5cf6', 'icon': 'school', 'is_income': False},
            {'name': 'Ropa', 'color': '#ec4899', 'icon': 'checkroom', 'is_income': False},
            {'name': 'Suscripciones', 'color': '#6366f1', 'icon': 'subscriptions', 'is_income': False},
            {'name': 'Otros gastos', 'color': '#64748b', 'icon': 'receipt', 'is_income': False},
            {'name': 'Nómina', 'color': '#10b981', 'icon': 'work', 'is_income': True},
            {'name': 'Otros ingresos', 'color': '#34d399', 'icon': 'savings', 'is_income': True},
        ]
        for cat in default_categories:
            Category.objects.create(user=user, **cat)

        return user
