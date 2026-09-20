from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AccountViewSet, CategoryViewSet, TransactionViewSet,
    ImportBatchViewSet, ClassificationRuleViewSet, AlertViewSet, BudgetViewSet,
    SyncViewSet,
    UserDataView, UserConsentView, UserProfileInsightsView,
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'imports', ImportBatchViewSet, basename='importbatch')
router.register(r'rules', ClassificationRuleViewSet, basename='classificationrule')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'budgets', BudgetViewSet, basename='budget')
router.register(r'sync', SyncViewSet, basename='sync')

urlpatterns = [
    path('', include(router.urls)),
    # RGPD Compliance endpoints
    path('user/data/', UserDataView.as_view(), name='user-data'),
    path('user/consent/', UserConsentView.as_view(), name='user-consent'),
    path('user/profiling-info/', UserProfileInsightsView.as_view(), name='user-profiling-info'),
]
