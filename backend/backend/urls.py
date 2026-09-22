"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from pathlib import Path
from django.contrib import admin
from django.urls import path, include, re_path
from django.http import HttpResponse, JsonResponse
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from api.views import RegisterView

def health_check(request):
    return JsonResponse({'status': 'ok', 'app': 'FinancIAs', 'message': 'Server is running'})

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', health_check, name='health_check'),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api/documents/', include('documents.urls')),
    path('api/banking/', include('banking.urls')),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/register/', RegisterView.as_view(), name='register'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# SPA catch-all: serve index.html for any non-API route (production only)
FRONTEND_INDEX = Path('/app/frontend-dist/index.html')
if FRONTEND_INDEX.exists():
    def spa_view(request):
        return HttpResponse(
            FRONTEND_INDEX.read_text(),
            content_type='text/html'
        )
    urlpatterns += [re_path(r'^(?!api/|admin/).*$', spa_view)]

