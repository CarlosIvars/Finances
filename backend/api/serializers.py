from rest_framework import serializers
from .models import Account, Category, Transaction, ImportBatch, ClassificationRule, Alert, Budget


class CategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.ReadOnlyField(source='parent.name')
    subcategories = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'parent', 'parent_name', 'color', 'icon', 'is_income', 'subcategories']
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

    class Meta:
        model = Transaction
        fields = [
            'id', 'date', 'description', 'amount', 'type',
            'category', 'category_name', 'parent_category_name', 'category_color', 'category_icon', 'account', 'account_name',
            'raw_data', 'metadata', 'is_pending', 'import_batch', 'created_at'
        ]
        read_only_fields = ['user', 'created_at']

    def validate_category(self, value):
        """RGPD: Verificar que la categoría pertenece al usuario autenticado."""
        request = self.context.get('request')
        if value and request and value.user != request.user:
            raise serializers.ValidationError('Categoría no válida.')
        return value

    def validate_account(self, value):
        """RGPD: Verificar que la cuenta pertenece al usuario autenticado."""
        request = self.context.get('request')
        if value and request and value.user != request.user:
            raise serializers.ValidationError('Cuenta no válida.')
        return value


class ImportBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportBatch
        fields = ['id', 'file', 'uploaded_at', 'status']
        read_only_fields = ['user', 'uploaded_at', 'status']


class ClassificationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassificationRule
        fields = ['id', 'keyword', 'category']

    def validate_category(self, value):
        """RGPD: Verificar que la categoría pertenece al usuario autenticado."""
        request = self.context.get('request')
        if value and request and value.user != request.user:
            raise serializers.ValidationError('Categoría no válida.')
        return value


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
            'id', 'date', 'description', 'amount', 'type',
            'category', 'category_name', 'parent_category_name', 'category_color', 'category_icon',
            'raw_data', 'metadata', 'is_pending', 'created_at'
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
