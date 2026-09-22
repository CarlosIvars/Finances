from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AccountViewSet, CategoryViewSet, TransactionViewSet,
    ImportBatchViewSet, ClassificationRuleViewSet, AlertViewSet, BudgetViewSet,
    SyncViewSet, TaxViewSet,
    UserDataView, UserConsentView, UserProfileInsightsView,
)
from .oauth_views import (
    CSRFTokenView, AuthMeView, GoogleLoginUrlView, GoogleCallbackView, LogoutView,
    SessionLoginView
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
router.register(r'tax', TaxViewSet, basename='tax')

urlpatterns = [
    path('', include(router.urls)),
    # BFF & Auth endpoints
    path('auth/csrf/', CSRFTokenView.as_view(), name='auth-csrf'),
    path('auth/me/', AuthMeView.as_view(), name='auth-me'),
    path('auth/login/', SessionLoginView.as_view(), name='auth-login'),
    path('auth/google/url/', GoogleLoginUrlView.as_view(), name='auth-google-url'),
    path('auth/google/callback/', GoogleCallbackView.as_view(), name='auth-google-callback'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    # RGPD Compliance endpoints
    path('user/data/', UserDataView.as_view(), name='user-data'),
    path('user/consent/', UserConsentView.as_view(), name='user-consent'),
    path('user/profiling-info/', UserProfileInsightsView.as_view(), name='user-profiling-info'),
]

