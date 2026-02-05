from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Account, Category, Transaction, ImportBatch, ClassificationRule, Alert
from .serializers import (
    AccountSerializer, CategorySerializer, TransactionSerializer, 
    ImportBatchSerializer, ClassificationRuleSerializer, AlertSerializer
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
