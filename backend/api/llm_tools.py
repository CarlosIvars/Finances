import logging
from django.core.exceptions import PermissionDenied
from api.models import Transaction, Category, Budget
from documents.models import Document

logger = logging.getLogger('api')

ALLOWED_LLM_TOOLS = {
    'get_user_transactions',
    'get_user_categories',
    'get_user_budgets',
    'search_user_documents',
    'get_document_metadata',
}


class LLMToolRegistry:
    """
    Registro y barrera de autorización para herramientas ejecutables por el LLM.
    Cumple con las Secciones 34, 35, 63 y 115 de SECURITY_PLAN.md:
    - Allowlist explícita (bloquea cualquier llamada no registrada).
    - Scope forzado al usuario autenticado (Zero Trust en el input del LLM).
    - Validación y aislamiento de parámetros.
    """

    @classmethod
    def execute_tool(cls, user, tool_name: str, **kwargs) -> dict:
        if not user or not user.is_authenticated:
            raise PermissionDenied("Se requiere un usuario autenticado para ejecutar herramientas de IA.")

        if tool_name not in ALLOWED_LLM_TOOLS:
            logger.warning(f"Intento de ejecución de herramienta no autorizada por LLM: {tool_name} por usuario {user.id}")
            raise PermissionDenied(f"Herramienta de IA no permitida: '{tool_name}'.")

        handler = getattr(cls, f"_tool_{tool_name}", None)
        if not handler:
            raise PermissionDenied(f"Controlador no implementado para '{tool_name}'.")

        return handler(user, **kwargs)

    @classmethod
    def _tool_get_user_transactions(cls, user, limit: int = 50, category_id: int = None, transaction_type: str = None) -> dict:
        limit = min(max(1, int(limit)), 100)
        qs = Transaction.objects.filter(user=user).select_related('category', 'account').order_by('-date')

        if category_id:
            qs = qs.filter(category_id=category_id, category__user=user)
        if transaction_type in ('income', 'expense', 'transfer'):
            qs = qs.filter(type=transaction_type)

        txs = list(qs[:limit].values(
            'id', 'date', 'amount', 'description', 'type', 'category__name', 'account__name'
        ))
        return {'status': 'success', 'count': len(txs), 'transactions': txs}

    @classmethod
    def _tool_get_user_categories(cls, user) -> dict:
        cats = list(Category.objects.filter(user=user).values('id', 'name', 'is_income', 'tax_deductible'))
        return {'status': 'success', 'count': len(cats), 'categories': cats}

    @classmethod
    def _tool_get_user_budgets(cls, user) -> dict:
        budgets = list(Budget.objects.filter(user=user).select_related('category').values(
            'id', 'amount', 'category__name', 'start_date', 'end_date'
        ))
        return {'status': 'success', 'count': len(budgets), 'budgets': budgets}

    @classmethod
    def _tool_search_user_documents(cls, user, query: str = "", limit: int = 20) -> dict:
        limit = min(max(1, int(limit)), 50)
        qs = Document.objects.filter(user=user)
        if query:
            qs = qs.filter(file_name__icontains=str(query)[:100])
        docs = list(qs[:limit].values('id', 'file_name', 'status', 'email_sender', 'email_subject', 'created_at'))
        return {'status': 'success', 'count': len(docs), 'documents': docs}

    @classmethod
    def _tool_get_document_metadata(cls, user, document_id: int) -> dict:
        try:
            doc = Document.objects.get(id=document_id, user=user)
            return {
                'status': 'success',
                'document': {
                    'id': doc.id,
                    'file_name': doc.file_name,
                    'file_size': doc.file_size,
                    'status': doc.status,
                    'email_sender': doc.email_sender,
                    'email_subject': doc.email_subject,
                    'created_at': doc.created_at.isoformat(),
                }
            }
        except Document.DoesNotExist:
            return {'status': 'not_found', 'error': 'Documento no encontrado o no pertenece al usuario.'}
