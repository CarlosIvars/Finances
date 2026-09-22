from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DocumentViewSet, GmailAuthUrlView, GmailCallbackView, GmailSyncView, GmailStatusView
)

router = DefaultRouter()
router.register(r'', DocumentViewSet, basename='document')

urlpatterns = [
    path('gmail/auth-url/', GmailAuthUrlView.as_view(), name='gmail-auth-url'),
    path('gmail/callback/', GmailCallbackView.as_view(), name='gmail-callback'),
    path('gmail/sync/', GmailSyncView.as_view(), name='gmail-sync'),
    path('gmail/status/', GmailStatusView.as_view(), name='gmail-status'),
    path('', include(router.urls)),
]

