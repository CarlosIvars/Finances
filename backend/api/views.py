from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Account, Category, Transaction, ImportBatch, ClassificationRule
from .serializers import (
    AccountSerializer, CategorySerializer, TransactionSerializer, 
    ImportBatchSerializer, ClassificationRuleSerializer
)


class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    
    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        
        # If category was updated, trigger learning
        if 'category' in request.data and request.data['category']:
            from .services import learn_from_categorization
            learn_from_categorization(kwargs.get('pk'))
        
        return response


class ImportBatchViewSet(viewsets.ModelViewSet):
    queryset = ImportBatch.objects.all()
    serializer_class = ImportBatchSerializer

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
    queryset = ClassificationRule.objects.all()
    serializer_class = ClassificationRuleSerializer
