import logging
import os
import shutil

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission
from rest_framework.views import APIView
from django.db.models import Sum
from datetime import date, datetime
from django.utils import timezone
from .models import Account, Category, Transaction, ImportBatch, ClassificationRule, Alert, Budget, UserConsent, AuditLog
from .serializers import (
    AccountSerializer, CategorySerializer, TransactionSerializer, 
    ImportBatchSerializer, ClassificationRuleSerializer, AlertSerializer, BudgetSerializer,
    SyncTransactionSerializer, RegisterSerializer
)

logger = logging.getLogger('api')


class IsOwner(BasePermission):
    """RGPD: Solo el propietario puede acceder a sus propios datos."""
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user


class RegisterView(APIView):
    """
    Registro de usuario con aceptación obligatoria de T&C.
    POST → Crea usuario, registra consentimiento, devuelve JWT tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()

        # Generate JWT tokens for auto-login
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)

        # Audit log
        AuditLog.objects.create(
            user=user,
            action='login',
            resource='registration',
            ip_address=_get_client_ip(request),
            details={'method': 'register'}
        )

        logger.info("user_registered", extra={'user_id': user.id, 'username': user.username})

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
            }
        }, status=status.HTTP_201_CREATED)



class AccountViewSet(viewsets.ModelViewSet):
    """SECURITY: Filter accounts by authenticated user"""
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Account.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CategoryViewSet(viewsets.ModelViewSet):
    """SECURITY: Filter categories by authenticated user"""
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Devuelve el árbol jerárquico de categorías (solo nodos raíz con sus subcategorías anidadas)."""
        root_categories = self.get_queryset().filter(parent__isnull=True).prefetch_related('children')
        serializer = self.get_serializer(root_categories, many=True)
        return Response(serializer.data)


class TransactionViewSet(viewsets.ModelViewSet):
    """SECURITY: Filter transactions by authenticated user"""
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).select_related('category', 'account')
    
    def create(self, request, *args, **kwargs):
        logger.info(
            "transaction_create_attempt",
            extra={
                'user_id': request.user.id,
                'has_category': bool(request.data.get('category')),
                'has_amount': bool(request.data.get('amount')),
            }
        )
        return super().create(request, *args, **kwargs)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        
        # If category was updated, trigger learning
        if 'category' in request.data and request.data['category']:
            from .services import learn_from_categorization
            learn_from_categorization(kwargs.get('pk'))
        
        return response


class ImportBatchViewSet(viewsets.ModelViewSet):
    """SECURITY: Filter import batches by authenticated user"""
    serializer_class = ImportBatchSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return ImportBatch.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def process_file(self, request, pk=None):
        from .services import process_import
        batch = self.get_object()
        try:
            count = process_import(batch.id)
            return Response({'status': 'processed', 'transactions_created': count})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ClassificationRuleViewSet(viewsets.ModelViewSet):
    """SECURITY: Filter classification rules by authenticated user"""
    serializer_class = ClassificationRuleSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return ClassificationRule.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AlertViewSet(viewsets.ModelViewSet):
    """Sistema de alertas con IA insights"""
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Alert.objects.filter(user=self.request.user, is_dismissed=False)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Obtener número de alertas no leídas"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Marcar alerta como leída"""
        alert = self.get_object()
        alert.is_read = True
        alert.save()
        return Response({'status': 'marked_read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Marcar todas las alertas como leídas"""
        self.get_queryset().update(is_read=True)
        return Response({'status': 'all_marked_read'})
    
    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Descartar alerta"""
        alert = self.get_object()
        alert.is_dismissed = True
        alert.save()
        return Response({'status': 'dismissed'})
    
    @action(detail=False, methods=['post'])
    def generate_insights(self, request):
        """Generar nuevos insights con IA"""
        from .insights import create_alerts_from_insights
        try:
            count = create_alerts_from_insights(request.user)
            return Response({'status': 'generated', 'alerts_created': count})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class BudgetViewSet(viewsets.ModelViewSet):
    """Gestión de presupuestos mensuales por categoría"""
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Budget.objects.filter(user=self.request.user).select_related('category')
        # Filter by month if provided
        month = self.request.query_params.get('month')
        if month:
            queryset = queryset.filter(month=month)
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def bulk_save(self, request):
        """Guardar múltiples presupuestos de una vez"""
        budgets_data = request.data.get('budgets', [])
        month = request.data.get('month')
        
        if not month:
            return Response({'error': 'month is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        created = 0
        updated = 0
        
        for item in budgets_data:
            category_id = item.get('category_id')
            amount = item.get('amount', 0)
            
            if category_id and float(amount) > 0:
                budget, was_created = Budget.objects.update_or_create(
                    user=request.user,
                    category_id=category_id,
                    month=month,
                    defaults={'amount': amount}
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
        
        return Response({
            'status': 'saved',
            'created': created,
            'updated': updated
        })
    
    @action(detail=False, methods=['get'])
    def comparison(self, request):
        """Comparar presupuesto vs gasto real del mes"""
        month_str = request.query_params.get('month')
        if month_str:
            month = date.fromisoformat(month_str)
        else:
            today = date.today()
            month = today.replace(day=1)
        
        # Get budgets for the month
        budgets = Budget.objects.filter(
            user=request.user,
            month=month
        ).select_related('category')
        
        # Get actual spending by category for the month
        next_month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
        
        spending = Transaction.objects.filter(
            user=request.user,
            type='expense',
            date__gte=month,
            date__lt=next_month
        ).values('category', 'category__name', 'category__color').annotate(
            spent=Sum('amount')
        )
        
        spending_map = {s['category']: abs(float(s['spent'])) for s in spending}
        
        comparison = []
        for budget in budgets:
            spent = spending_map.get(budget.category_id, 0)
            comparison.append({
                'category_id': budget.category_id,
                'category_name': budget.category.name,
                'category_color': budget.category.color,
                'budgeted': float(budget.amount),
                'spent': spent,
                'difference': float(budget.amount) - spent,
                'percentage': (spent / float(budget.amount) * 100) if budget.amount else 0
            })
        
        return Response({
            'month': month.isoformat(),
            'comparison': comparison,
            'total_budgeted': sum(c['budgeted'] for c in comparison),
            'total_spent': sum(c['spent'] for c in comparison)
        })
    
    @action(detail=False, methods=['post'])
    def get_advice(self, request):
        """Obtener consejos IA sobre cómo reducir gastos"""
        from .insights import generate_budget_advice
        month_str = request.data.get('month')
        
        if month_str:
            month = date.fromisoformat(month_str)
        else:
            today = date.today()
            month = today.replace(day=1)
        
        try:
            advice = generate_budget_advice(request.user, month)
            return Response({'advice': advice})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# Import for timedelta
from datetime import timedelta


class SyncViewSet(viewsets.ViewSet):
    """
    Mobile sync API - Pull/Push transactions for offline-first mobile app.
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def status(self, request):
        """Get sync status for the user"""
        transactions_count = Transaction.objects.filter(user=request.user).count()
        categories_count = Category.objects.filter(user=request.user).count()
        
        return Response({
            'transactions_count': transactions_count,
            'categories_count': categories_count,
            'server_time': timezone.now().isoformat(),
        })
    
    @action(detail=False, methods=['post'])
    def pull(self, request):
        """
        Pull transactions from server since a given timestamp.
        Used by mobile to get new/updated transactions.
        """
        since = request.data.get('since')  # ISO timestamp or None for all
        
        queryset = Transaction.objects.filter(user=request.user).select_related('category', 'account')
        
        if since:
            try:
                since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
                queryset = queryset.filter(created_at__gte=since_dt)
            except ValueError:
                return Response({'error': 'Invalid timestamp format'}, status=status.HTTP_400_BAD_REQUEST)
        
        transactions = queryset.order_by('created_at')[:500]  # Limit to avoid huge responses
        serializer = SyncTransactionSerializer(transactions, many=True)
        
        # Also return categories (they don't change often, small payload)
        categories = Category.objects.filter(user=request.user).select_related('parent')
        categories_data = [
            {
                'id': c.id,
                'name': c.name,
                'parent_id': c.parent_id,
                'parent_name': c.parent.name if c.parent else None,
                'color': c.color,
                'is_income': c.is_income
            }
            for c in categories
        ]
        
        return Response({
            'transactions': serializer.data,
            'categories': categories_data,
            'server_time': timezone.now().isoformat(),
            'has_more': queryset.count() > 500,
        })
    
    @action(detail=False, methods=['post'])
    def push(self, request):
        """
        Push transactions from mobile to server.
        Creates new transactions that don't exist on server.
        """
        transactions_data = request.data.get('transactions', [])
        
        if not isinstance(transactions_data, list):
            return Response({'error': 'transactions must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create default account
        account, _ = Account.objects.get_or_create(
            user=request.user,
            name="Main Account",
            defaults={'initial_balance': 0}
        )
        
        created = []
        errors = []
        
        for tx_data in transactions_data:
            try:
                local_id = tx_data.get('local_id')
                
                # Check if we already have this transaction (by checking if a transaction
                # with the same description, date, and amount exists)
                existing = Transaction.objects.filter(
                    user=request.user,
                    description=tx_data.get('description', ''),
                    date=tx_data.get('date'),
                    amount=tx_data.get('amount'),
                ).first()
                
                if existing:
                    # Update metadata/category if provided
                    if tx_data.get('metadata') and not existing.metadata:
                        existing.metadata = tx_data.get('metadata')
                        existing.save(update_fields=['metadata'])
                    created.append({
                        'local_id': local_id,
                        'server_id': existing.id,
                        'status': 'exists'
                    })
                    continue
                
                # Create new transaction
                category = None
                category_id = tx_data.get('category_id')
                if category_id:
                    try:
                        category = Category.objects.get(id=category_id, user=request.user)
                    except Category.DoesNotExist:
                        pass
                
                transaction = Transaction.objects.create(
                    user=request.user,
                    account=account,
                    category=category,
                    date=tx_data.get('date'),
                    description=tx_data.get('description', ''),
                    amount=tx_data.get('amount'),
                    type=tx_data.get('type', 'expense'),
                    raw_data=tx_data.get('raw_data', ''),
                    metadata=tx_data.get('metadata', {}),
                    is_pending=False,
                )
                
                created.append({
                    'local_id': local_id,
                    'server_id': transaction.id,
                    'status': 'created'
                })
                
            except Exception as e:
                errors.append({
                    'local_id': tx_data.get('local_id'),
                    'error': str(e)
                })
        
        return Response({
            'created': created,
            'errors': errors,
            'server_time': timezone.now().isoformat(),
        })


# ==========================================
# RGPD Compliance Views
# ==========================================

from rest_framework.throttling import UserRateThrottle


class InsightsThrottle(UserRateThrottle):
    """Rate limit para generación de insights IA (costosa y sensible)."""
    scope = 'insights'


def _get_client_ip(request):
    """Extrae la IP del cliente de forma segura."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class UserDataView(APIView):
    """
    RGPD Art. 15 (Acceso) + Art. 17 (Supresión) + Art. 20 (Portabilidad).
    GET  → Exportar todos los datos del usuario en JSON.
    DELETE → Borrar cuenta y TODOS los datos permanentemente.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Derecho de acceso y portabilidad: exportar todos los datos."""
        user = request.user

        data = {
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'date_joined': user.date_joined.isoformat(),
                'last_login': user.last_login.isoformat() if user.last_login else None,
            },
            'accounts': list(Account.objects.filter(user=user).values(
                'id', 'name', 'bank_name', 'initial_balance', 'currency', 'created_at'
            )),
            'categories': list(Category.objects.filter(user=user).values(
                'id', 'name', 'color', 'is_income'
            )),
            'transactions': list(Transaction.objects.filter(user=user).values(
                'id', 'date', 'description', 'amount', 'type',
                'category__name', 'account__name', 'created_at'
            )),
            'budgets': list(Budget.objects.filter(user=user).values(
                'category__name', 'amount', 'month'
            )),
            'classification_rules': list(ClassificationRule.objects.filter(user=user).values(
                'keyword', 'category__name'
            )),
            'consents': list(UserConsent.objects.filter(user=user).values(
                'consent_type', 'granted', 'timestamp', 'version'
            )),
        }

        # Audit log
        AuditLog.objects.create(
            user=user,
            action='export',
            resource='user_data_complete',
            ip_address=_get_client_ip(request),
            details={'format': 'json', 'record_counts': {
                k: len(v) for k, v in data.items() if isinstance(v, list)
            }}
        )

        logger.info("user_data_export", extra={'user_id': user.id})
        return Response(data)

    def delete(self, request):
        """
        Derecho de supresión: borrar cuenta y TODOS los datos.
        Los consentimientos se conservan anonimizados (prueba legal).
        """
        user = request.user
        user_id = user.id

        # Audit log BEFORE deletion
        AuditLog.objects.create(
            user=None,  # Will be orphaned after deletion (intentional)
            action='delete',
            resource='user_account_complete',
            ip_address=_get_client_ip(request),
            details={'deleted_user_id': user_id}
        )

        # Anonimizar consentimientos (prueba legal, sin referencia al usuario)
        UserConsent.objects.filter(user=user).update(user=None)

        # Borrar datos en orden (respeta foreign keys)
        Alert.objects.filter(user=user).delete()
        Budget.objects.filter(user=user).delete()
        Transaction.objects.filter(user=user).delete()
        ClassificationRule.objects.filter(user=user).delete()
        Category.objects.filter(user=user).delete()
        ImportBatch.objects.filter(user=user).delete()
        Account.objects.filter(user=user).delete()

        # Borrar archivos subidos
        user_media = os.path.join('media', 'uploads')
        if os.path.exists(user_media):
            for batch in ImportBatch.objects.filter(user=user):
                if batch.file and os.path.exists(batch.file.path):
                    os.remove(batch.file.path)

        # Borrar usuario (invalida todos los tokens JWT)
        user.delete()

        logger.info("user_account_deleted", extra={'deleted_user_id': user_id})
        return Response(
            {'message': 'Cuenta y todos los datos eliminados permanentemente.'},
            status=status.HTTP_200_OK
        )


class UserConsentView(APIView):
    """
    RGPD Art. 7: Gestión de consentimientos del usuario.
    GET  → Estado actual de todos los consentimientos.
    POST → Actualizar consentimientos (registra historial auditable).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Devuelve estado actual de todos los consentimientos."""
        consents = UserConsent.get_all_consents(request.user)
        return Response({
            'consents': consents,
            'available_types': [
                {
                    'key': key,
                    'label': label,
                    'description': self._get_description(key),
                }
                for key, label in UserConsent.CONSENT_TYPES
            ]
        })

    def post(self, request):
        """
        Actualizar consentimientos. Espera: { "consents": { "ai_processing": true, ... } }
        Cada cambio se registra como entrada independiente para auditoría.
        """
        consents_data = request.data.get('consents', {})
        valid_types = dict(UserConsent.CONSENT_TYPES)
        updated = []

        for consent_type, granted in consents_data.items():
            if consent_type not in valid_types:
                continue

            UserConsent.objects.create(
                user=request.user,
                consent_type=consent_type,
                granted=bool(granted),
            )
            updated.append(consent_type)

        # Audit log
        AuditLog.objects.create(
            user=request.user,
            action='consent_change',
            resource='user_consents',
            ip_address=_get_client_ip(request),
            details={'updated_types': updated}
        )

        logger.info("consent_updated", extra={
            'user_id': request.user.id,
            'types': updated
        })

        return Response({
            'status': 'updated',
            'consents': UserConsent.get_all_consents(request.user)
        })

    @staticmethod
    def _get_description(consent_type: str) -> str:
        descriptions = {
            'ai_processing': 'Permite generar insights, predicciones y recomendaciones '
                             'personalizadas basadas en tus gastos utilizando inteligencia artificial.',
            'external_ai': 'Permite que tus datos anonimizados sean procesados por un proveedor '
                           'de IA externo (ej. OpenAI) para análisis avanzado. Tus datos se '
                           'anonimizan antes del envío.',
            'analytics': 'Permite recopilar datos de uso de la aplicación para mejorar '
                         'la experiencia de usuario.',
        }
        return descriptions.get(consent_type, '')


class UserProfileInsightsView(APIView):
    """
    RGPD Art. 22: Transparencia sobre decisiones automatizadas y perfilado.
    Informa al usuario sobre qué datos se procesan y cómo.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        consents = UserConsent.get_all_consents(request.user)

        return Response({
            'automated_processing': {
                'description': 'Analizamos tus transacciones para generar insights, '
                               'detectar anomalías de gasto y sugerir presupuestos.',
                'data_used': [
                    'Categoría de gasto',
                    'Importe de transacción',
                    'Fecha de transacción',
                    'Frecuencia de gastos recurrentes',
                ],
                'data_NOT_used': [
                    'Concepto bancario original (se anonimiza antes de enviar a IA)',
                    'Datos de identificación personal',
                    'IBAN o números de cuenta',
                ],
                'purpose': 'Ayudarte a gestionar mejor tus finanzas personales.',
                'impact': 'Te mostramos alertas y recomendaciones. NUNCA se toman '
                          'decisiones que te afecten jurídica o significativamente.',
                'opt_out': 'Puedes desactivar el análisis IA desde Privacidad > Consentimientos.',
                'ai_enabled': consents.get('ai_processing', False),
                'external_ai_enabled': consents.get('external_ai', False),
            }
        })

