from __future__ import annotations
import logging
from typing import Optional
from .models import AuditLog

audit_logger = logging.getLogger('audit')


class AuditMiddleware:
    """
    Middleware que registra automáticamente accesos a endpoints sensibles.
    Solo registra metadata (no datos del request/response body).
    """

    # Endpoints que contienen datos personales y deben auditarse
    AUDIT_PATHS = {
        '/api/transactions/': 'transactions',
        '/api/user/data/': 'user_data',
        '/api/user/consent/': 'user_consents',
        '/api/accounts/': 'accounts',
        '/api/alerts/generate_insights/': 'ai_insights',
        '/api/budgets/get_advice/': 'ai_budget_advice',
    }

    # Solo auditar estos métodos (no OPTIONS, HEAD, etc.)
    AUDIT_METHODS = {'GET', 'POST', 'PUT', 'PATCH', 'DELETE'}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Solo auditar si: autenticado + método relevante + endpoint sensible + éxito
        if (
            hasattr(request, 'user')
            and request.user.is_authenticated
            and request.method in self.AUDIT_METHODS
            and response.status_code < 400
        ):
            resource = self._match_path(request.path)
            if resource:
                action = self._method_to_action(request.method)
                try:
                    AuditLog.objects.create(
                        user=request.user,
                        action=action,
                        resource=resource,
                        ip_address=self._get_client_ip(request),
                        details={
                            'method': request.method,
                            'path': request.path,
                            'status_code': response.status_code,
                        }
                    )
                    audit_logger.info(
                        f"audit:{action}:{resource}",
                        extra={
                            'user_id': request.user.id,
                            'path': request.path,
                            'method': request.method,
                        }
                    )
                except Exception:
                    # Audit should never break the app
                    audit_logger.error("audit_log_failed", exc_info=True)

        return response

    def _match_path(self, path: str) -> Optional[str]:
        """Encuentra si el path coincide con un endpoint auditable."""
        for audit_path, resource in self.AUDIT_PATHS.items():
            if path.startswith(audit_path):
                return resource
        return None

    @staticmethod
    def _method_to_action(method: str) -> str:
        """Mapea método HTTP a tipo de acción de auditoría."""
        mapping = {
            'GET': 'view',
            'POST': 'modify',
            'PUT': 'modify',
            'PATCH': 'modify',
            'DELETE': 'delete',
        }
        return mapping.get(method, 'view')

    @staticmethod
    def _get_client_ip(request) -> Optional[str]:

        """Extrae IP del cliente."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')
