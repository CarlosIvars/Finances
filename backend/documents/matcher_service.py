import re
from datetime import timedelta
from decimal import Decimal
from django.db.models import Q
from api.models import Transaction, Alert


class MatcherService:
    """Motor de vinculación inteligente entre Documentos (facturas/recibos) y Transacciones bancarias."""

    @classmethod
    def match_document(cls, document) -> str:
        """
        Intenta vincular automáticamente o sugerir una transacción para el documento.
        Retorna el estado resultante ('auto_matched', 'suggested', 'unmatched').
        """
        if document.transaction:
            return document.status

        user = document.user
        doc_date = document.email_date.date() if document.email_date else document.created_at.date()
        amount_hint = document.amount_hint

        # 1. Búsqueda por importe exacto si se extrajo un importe sugerido
        if amount_hint:
            target_amount = Decimal(str(amount_hint))
            date_min = doc_date - timedelta(days=3)
            date_max = doc_date + timedelta(days=3)

            # Buscar transacciones (ingreso o gasto) con importe coincidente (positivo o negativo)
            exact_tx = Transaction.objects.filter(
                user=user,
                is_deleted=False,
                date__gte=date_min,
                date__lte=date_max
            ).filter(
                Q(amount=target_amount) | Q(amount=-target_amount)
            ).first()

            if exact_tx:
                document.transaction = exact_tx
                document.suggested_transaction = None
                document.status = 'auto_matched'
                document.save(update_fields=['transaction', 'suggested_transaction', 'status', 'updated_at'])

                # Generar alerta de notificación en la app
                cls._create_match_alert(user, document, exact_tx)
                return 'auto_matched'

        # 2. Búsqueda por coincidencia de emisor / palabras clave en la descripción
        keywords = cls._extract_keywords(document)
        if keywords:
            date_min_broad = doc_date - timedelta(days=7)
            date_max_broad = doc_date + timedelta(days=7)

            q_filter = Q()
            for kw in keywords:
                if len(kw) >= 3:
                    q_filter |= Q(description__icontains=kw) | Q(raw_data__icontains=kw)

            candidate_txs = Transaction.objects.filter(
                user=user,
                is_deleted=False,
                date__gte=date_min_broad,
                date__lte=date_max_broad
            ).filter(q_filter)

            # Si hay candidatos:
            if candidate_txs.exists():
                # Si además coincide el importe con amount_hint, es match exacto
                if amount_hint:
                    target_amount = Decimal(str(amount_hint))
                    for tx in candidate_txs:
                        if abs(tx.amount) == target_amount:
                            document.transaction = tx
                            document.suggested_transaction = None
                            document.status = 'auto_matched'
                            document.save(update_fields=['transaction', 'suggested_transaction', 'status', 'updated_at'])
                            cls._create_match_alert(user, document, tx)
                            return 'auto_matched'

                # Si solo coincide emisor y fecha cercana, sugerir la más cercana en fecha
                best_candidate = candidate_txs.order_by('date').first()
                document.suggested_transaction = best_candidate
                document.status = 'suggested'
                document.save(update_fields=['suggested_transaction', 'status', 'updated_at'])
                return 'suggested'

        document.status = 'unmatched'
        document.save(update_fields=['status', 'updated_at'])
        return 'unmatched'

    @classmethod
    def _create_match_alert(cls, user, document, transaction):
        """Crea una notificación Alert para el usuario informando del emparejamiento."""
        try:
            Alert.objects.create(
                user=user,
                type='reminder',
                title='📄 Factura vinculada automáticamente',
                message=f'Se ha vinculado el documento "{document.file_name}" a la transacción "{transaction.description}" ({abs(transaction.amount):.2f}€).',
                icon='📄',
                related_data={
                    'transaction_id': transaction.id,
                    'document_id': document.id,
                    'amount': float(transaction.amount),
                    'date': str(transaction.date)
                }
            )
        except Exception:
            pass

    @classmethod
    def _extract_keywords(cls, document) -> list:
        """Extrae palabras clave representativas del emisor, asunto y nombre del archivo."""
        raw_text = f"{document.email_sender} {document.email_subject} {document.file_name}"
        # Limpiar caracteres especiales
        tokens = re.findall(r'[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3,}', raw_text)
        stopwords = {
            'factura', 'invoice', 'recibo', 'comprobante', 'justificante', 'pdf', 'png', 'jpg',
            'para', 'desde', 'cuenta', 'pago', 'orden', 'pedido', 'gmail', 'mail', 'noreply',
            'no-reply', 'service', 'services', 'info', 'hola', 'estimado', 'cliente'
        }
        return [t.lower() for t in tokens if t.lower() not in stopwords]

    @classmethod
    def confirm_match(cls, document, user) -> bool:
        if document.user != user or not document.suggested_transaction:
            return False
        document.transaction = document.suggested_transaction
        document.suggested_transaction = None
        document.status = 'confirmed'
        document.save(update_fields=['transaction', 'suggested_transaction', 'status', 'updated_at'])
        return True

    @classmethod
    def reject_suggestion(cls, document, user) -> bool:
        if document.user != user:
            return False
        document.suggested_transaction = None
        document.status = 'unmatched'
        document.save(update_fields=['suggested_transaction', 'status', 'updated_at'])
        return True

    @classmethod
    def link_transaction(cls, document, transaction, user) -> bool:
        if document.user != user or transaction.user != user:
            return False
        document.transaction = transaction
        document.suggested_transaction = None
        document.status = 'confirmed'
        document.save(update_fields=['transaction', 'suggested_transaction', 'status', 'updated_at'])
        return True

    @classmethod
    def unlink_transaction(cls, document, user) -> bool:
        if document.user != user:
            return False
        document.transaction = None
        document.suggested_transaction = None
        document.status = 'unmatched'
        document.save(update_fields=['transaction', 'suggested_transaction', 'status', 'updated_at'])
        return True

