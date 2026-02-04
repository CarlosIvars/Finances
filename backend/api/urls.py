from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AccountViewSet, CategoryViewSet, TransactionViewSet, 
    ImportBatchViewSet, ClassificationRuleViewSet
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'imports', ImportBatchViewSet)
router.register(r'rules', ClassificationRuleViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
