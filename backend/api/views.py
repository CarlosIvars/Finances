import logging
import os
import shutil

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission
from rest_framework.views import APIView
from django.db.models import Sum, Q
from datetime import date, datetime, timedelta
from collections import defaultdict
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
        return Transaction.objects.filter(user=self.request.user, is_deleted=False).select_related('category', 'account')
    
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
        import uuid
        client_id = serializer.validated_data.get('client_id')
        if not client_id:
            client_id = f"web_{uuid.uuid4().hex}"
        serializer.save(user=self.request.user, client_id=client_id)
    
    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['is_deleted', 'deleted_at', 'updated_at'])
    
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
        """Comparar presupuesto vs gasto real del mes con desglose jerárquico (árbol) y rollup"""
        month_str = request.query_params.get('month')
        if month_str:
            month = date.fromisoformat(month_str)
        else:
            today = date.today()
            month = today.replace(day=1)
        
        # Calculate next month boundary
        next_month = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
        
        # All expense transactions for the month
        expense_txs = Transaction.objects.filter(
            user=request.user,
            is_deleted=False,
            type='expense',
            date__gte=month,
            date__lt=next_month
        )
        
        # Total real spent for the month across all transactions (avoids double counting)
        total_spent_agg = expense_txs.aggregate(total=Sum('amount'))['total']
        total_spent_global = abs(float(total_spent_agg or 0))
        
        # Spending by category
        spending_records = expense_txs.values('category').annotate(spent=Sum('amount'))
        direct_spending_map = {s['category']: abs(float(s['spent'])) for s in spending_records if s['category'] is not None}
        
        # Budgets for the month
        budgets = Budget.objects.filter(
            user=request.user,
            month=month
        ).select_related('category')
        budget_map = {b.category_id: float(b.amount) for b in budgets}
        
        # Get all expense categories for user
        categories = Category.objects.filter(
            user=request.user,
            is_income=False
        ).select_related('parent')
        
        children_by_parent = defaultdict(list)
        root_categories = []
        
        for cat in categories:
            if cat.parent_id:
                children_by_parent[cat.parent_id].append(cat)
            else:
                root_categories.append(cat)
        
        tree = []
        flat_comparison = []
        
        for root in root_categories:
            root_direct_spent = direct_spending_map.get(root.id, 0.0)
            root_budget = budget_map.get(root.id, 0.0)
            
            children_items = []
            children_spent_sum = 0.0
            children_budget_sum = 0.0
            
            for child in children_by_parent.get(root.id, []):
                child_spent = direct_spending_map.get(child.id, 0.0)
                child_budget = budget_map.get(child.id, 0.0)
                children_spent_sum += child_spent
                children_budget_sum += child_budget
                
                diff = child_budget - child_spent if child_budget > 0 else -child_spent
                child_pct = (child_spent / child_budget * 100) if child_budget > 0 else 0.0
                
                child_item = {
                    'category_id': child.id,
                    'category_name': child.name,
                    'category_color': child.color,
                    'category_icon': child.icon,
                    'parent_id': root.id,
                    'parent_name': root.name,
                    'budgeted': child_budget,
                    'spent': child_spent,
                    'difference': diff,
                    'percentage': child_pct,
                    'percentage_of_parent': 0.0
                }
                children_items.append(child_item)
                
                flat_comparison.append({
                    'category_id': child.id,
                    'category_name': child.name,
                    'category_color': child.color,
                    'category_icon': child.icon,
                    'parent_id': root.id,
                    'parent_name': root.name,
                    'budgeted': child_budget,
                    'spent': child_spent,
                    'difference': diff,
                    'percentage': child_pct,
                    'is_child': True
                })
            
            # Rollup: Root total spent is direct spent on parent + sum of all children's spent
            root_total_spent = root_direct_spent + children_spent_sum
            effective_budget = root_budget if root_budget > 0 else children_budget_sum
            
            for child_item in children_items:
                if root_total_spent > 0:
                    child_item['percentage_of_parent'] = round((child_item['spent'] / root_total_spent) * 100, 1)
                else:
                    child_item['percentage_of_parent'] = 0.0
            
            root_diff = effective_budget - root_total_spent
            root_pct = (root_total_spent / effective_budget * 100) if effective_budget > 0 else 0.0
            
            root_node = {
                'category_id': root.id,
                'category_name': root.name,
                'category_color': root.color,
                'category_icon': root.icon,
                'parent_id': None,
                'budgeted': effective_budget,
                'direct_budgeted': root_budget,
                'children_budgeted': children_budget_sum,
                'spent': root_total_spent,
                'spent_direct': root_direct_spent,
                'children_spent': children_spent_sum,
                'difference': root_diff,
                'percentage': root_pct,
                'has_subcategories': len(children_items) > 0,
                'subcategories': children_items
            }
            tree.append(root_node)
            
            flat_comparison.append({
                'category_id': root.id,
                'category_name': root.name,
                'category_color': root.color,
                'category_icon': root.icon,
                'parent_id': None,
                'budgeted': effective_budget,
                'spent': root_total_spent,
                'difference': root_diff,
                'percentage': root_pct,
                'is_child': False
            })
        
        # Calculate total budgeted as sum of effective budgets of root categories (avoids double counting)
        total_budgeted = sum(r['budgeted'] for r in tree)
        
        return Response({
            'month': month.isoformat(),
            'comparison': tree,
            'tree': tree,
            'flat': flat_comparison,
            'total_budgeted': total_budgeted,
            'total_spent': total_spent_global
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
        
        queryset = Transaction.objects.filter(user=request.user).select_related('category__parent', 'account')
        
        if since:
            try:
                since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
                queryset = queryset.filter(Q(updated_at__gte=since_dt) | Q(created_at__gte=since_dt))
            except ValueError:
                return Response({'error': 'Invalid timestamp format'}, status=status.HTTP_400_BAD_REQUEST)
        
        transactions_limit = 2000 if not since else 500
        transactions = queryset.order_by('created_at')[:transactions_limit]  # Allow full history on initial/hard sync
        serializer = SyncTransactionSerializer(transactions, many=True)
        
        # Collect deleted IDs for mobile synchronization
        deleted_ids = list(
            queryset.filter(is_deleted=True).values_list('id', flat=True)
        )
        deleted_client_ids = list(
            queryset.filter(is_deleted=True).exclude(client_id__isnull=True).values_list('client_id', flat=True)
        )

        # Also return categories (they don't change often, small payload)
        categories = Category.objects.filter(user=request.user).select_related('parent')
        categories_data = [
            {
                'id': c.id,
                'name': c.name,
                'parent_id': c.parent_id,
                'parent_name': c.parent.name if c.parent else None,
                'color': c.color,
                'icon': c.icon,
                'is_income': c.is_income
            }
            for c in categories
        ]
        
        # Budgets for user (most recent per category)
        budgets = Budget.objects.filter(user=request.user).select_related('category').order_by('-month')
        seen_cats = set()
        budgets_data = []
        for b in budgets:
            if b.category_id not in seen_cats:
                seen_cats.add(b.category_id)
                budgets_data.append({
                    'category_id': str(b.category_id),
                    'category_name': b.category.name,
                    'amount': float(b.amount),
                    'color': b.category.color,
                    'month': b.month.isoformat()
                })
        
        return Response({
            'transactions': serializer.data,
            'deleted_ids': deleted_ids,
            'deleted_client_ids': deleted_client_ids,
            'categories': categories_data,
            'budgets': budgets_data,
            'server_time': timezone.now().isoformat(),
            'has_more': queryset.count() > transactions_limit,
        })
    
    @action(detail=False, methods=['post'])
    def push(self, request):
        """
        Push transactions from mobile to server.
        Creates new transactions or updates existing ones.
        Also accepts deleted_ids and deleted_client_ids for soft deletion.
        """
        transactions_data = request.data.get('transactions', [])
        deleted_ids = request.data.get('deleted_ids', [])
        deleted_client_ids = request.data.get('deleted_client_ids', [])

        # Process deletions from client
        if isinstance(deleted_ids, list):
            for del_id in deleted_ids:
                if isinstance(del_id, int) or (isinstance(del_id, str) and del_id.isdigit()):
                    Transaction.objects.filter(user=request.user, id=int(del_id), is_deleted=False).update(
                        is_deleted=True, deleted_at=timezone.now(), updated_at=timezone.now()
                    )
                elif isinstance(del_id, str) and del_id:
                    Transaction.objects.filter(user=request.user, client_id=del_id, is_deleted=False).update(
                        is_deleted=True, deleted_at=timezone.now(), updated_at=timezone.now()
                    )

        if isinstance(deleted_client_ids, list):
            for cid in deleted_client_ids:
                if cid:
                    Transaction.objects.filter(user=request.user, client_id=cid, is_deleted=False).update(
                        is_deleted=True, deleted_at=timezone.now(), updated_at=timezone.now()
                    )

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
                server_id = tx_data.get('server_id')
                client_id = tx_data.get('client_id') or local_id

                category = None
                category_id = tx_data.get('category_id')
                if category_id:
                    try:
                        category = Category.objects.get(id=category_id, user=request.user)
                    except Category.DoesNotExist:
                        category = None
                
                # Check if we already have this transaction:
                # 1. By server_id
                existing = None
                if server_id and (isinstance(server_id, int) or (isinstance(server_id, str) and str(server_id).isdigit())):
                    existing = Transaction.objects.filter(user=request.user, id=int(server_id)).first()

                # 2. By client_id
                if not existing and client_id:
                    existing = Transaction.objects.filter(user=request.user, client_id=client_id).first()

                # 3. Fallback: by date, description, amount
                if not existing:
                    existing = Transaction.objects.filter(
                        user=request.user,
                        description=tx_data.get('description', ''),
                        date=tx_data.get('date'),
                        amount=tx_data.get('amount'),
                    ).first()
                
                if existing:
                    update_fields = []
                    if client_id and not existing.client_id:
                        existing.client_id = client_id
                        update_fields.append('client_id')
                    new_desc = tx_data.get('description')
                    if new_desc and existing.description != new_desc:
                        existing.description = new_desc
                        update_fields.append('description')
                    new_amt = tx_data.get('amount')
                    if new_amt is not None and existing.amount != new_amt:
                        existing.amount = new_amt
                        existing.type = 'income' if float(new_amt) >= 0 else 'expense'
                        update_fields.extend(['amount', 'type'])
                    new_dt = tx_data.get('date')
                    if new_dt and str(existing.date) != str(new_dt):
                        existing.date = new_dt
                        update_fields.append('date')
                    if tx_data.get('metadata') and not existing.metadata:
                        existing.metadata = tx_data.get('metadata')
                        update_fields.append('metadata')
                    if category_id and category and existing.category_id != category.id:
                        existing.category = category
                        existing.is_pending = False
                        update_fields.extend(['category', 'is_pending'])
                    if update_fields:
                        update_fields.append('updated_at')
                        existing.save(update_fields=update_fields)

                    created.append({
                        'local_id': local_id,
                        'client_id': existing.client_id,
                        'server_id': existing.id,
                        'status': 'updated' if update_fields else 'exists'
                    })
                    continue
                
                # Create new transaction
                transaction = Transaction.objects.create(
                    user=request.user,
                    account=account,
                    category=category,
                    client_id=client_id,
                    date=tx_data.get('date'),
                    description=tx_data.get('description', ''),
                    amount=tx_data.get('amount'),
                    type=tx_data.get('type', 'expense'),
                    raw_data=tx_data.get('raw_data', ''),
                    metadata=tx_data.get('metadata', {}),
                    is_pending=category is None,
                )
                
                created.append({
                    'local_id': local_id,
                    'client_id': transaction.client_id,
                    'server_id': transaction.id,
                    'status': 'created'
                })
                
            except Exception as e:
                errors.append({
                    'local_id': tx_data.get('local_id'),
                    'error': str(e)
                })
        
        # Handle optional budgets from mobile
        budgets_data = request.data.get('budgets', [])
        if isinstance(budgets_data, list) and budgets_data:
            today = date.today()
            current_month = today.replace(day=1)
            for b in budgets_data:
                try:
                    cat_id = b.get('category_id')
                    amount = float(b.get('amount', 0))
                    cat = None
                    if isinstance(cat_id, int) or (isinstance(cat_id, str) and cat_id.isdigit()):
                        cat = Category.objects.filter(user=request.user, id=int(cat_id)).first()
                    if not cat:
                        cat_name = b.get('category_name')
                        if cat_name:
                            cat = Category.objects.filter(user=request.user, name__iexact=cat_name).first()
                    if cat and amount > 0:
                        Budget.objects.update_or_create(
                            user=request.user,
                            category=cat,
                            month=current_month,
                            defaults={'amount': amount}
                        )
                except Exception:
                    pass

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

