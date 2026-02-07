from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum
from datetime import date
from .models import Account, Category, Transaction, ImportBatch, ClassificationRule, Alert, Budget
from .serializers import (
    AccountSerializer, CategorySerializer, TransactionSerializer, 
    ImportBatchSerializer, ClassificationRuleSerializer, AlertSerializer, BudgetSerializer
)


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


class TransactionViewSet(viewsets.ModelViewSet):
    """SECURITY: Filter transactions by authenticated user"""
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).select_related('category', 'account')
    
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

