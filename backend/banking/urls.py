"""
URL routing para la app banking (Open Banking).
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from banking.views import (
    InstitutionListView,
    BankConnectionViewSet,
    BankCallbackView,
    BankAccountTransactionsView,
)

router = DefaultRouter()
router.register(r'connections', BankConnectionViewSet, basename='bank-connection')

urlpatterns = [
    path('institutions/', InstitutionListView.as_view(), name='bank-institutions'),
    path('callback/', BankCallbackView.as_view(), name='bank-callback'),
    path(
        'accounts/<int:account_id>/transactions/',
        BankAccountTransactionsView.as_view(),
        name='bank-account-transactions',
    ),
    path('', include(router.urls)),
]

