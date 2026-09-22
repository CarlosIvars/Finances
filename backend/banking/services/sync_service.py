from __future__ import annotations

"""
Servicio de sincronización bancaria.
Gestiona la obtención y deduplicación de transacciones bancarias.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone
from django.db import IntegrityError

from banking.models import (
    BankConnection, BankAccount, BankTransaction, SyncLog,
)
from banking.providers import get_provider
from banking.providers.base import AccountInfo, TransactionInfo
from api.models import Account, Transaction, Category, ClassificationRule
from api.services import find_category_by_learning

logger = logging.getLogger('banking')


class SyncService:
    """Sincroniza datos bancarios: cuentas, saldos y transacciones."""

    def __init__(self):
        self.provider = get_provider()

    def sync_connection(
        self,
        connection: BankConnection,
        sync_type: str = 'manual',
    ) -> SyncLog:
        """
        Sincroniza una conexión completa: cuentas + transacciones.
        Devuelve el SyncLog con el resultado.
        """
        sync_log = SyncLog.objects.create(
            bank_connection=connection,
            sync_type=sync_type,
            status='running',
        )

        try:
            if not connection.is_consent_valid():
                raise ValueError(
                    f"Connection {connection.id} consent is not valid "
                    f"(status={connection.status})"
                )

            # 1. Sincronizar cuentas
            accounts_synced = self._sync_accounts(connection)
            sync_log.accounts_synced = accounts_synced

            # 2. Sincronizar transacciones para cada cuenta
            total_added = 0
            total_updated = 0
            for bank_account in connection.bank_accounts.all():
                added, updated = self._sync_transactions(
                    connection, bank_account,
                )
                total_added += added
                total_updated += updated

            # 3. Vincular cuentas y copiar transacciones a api.models.Transaction
            self._link_and_copy_transactions(connection)

            sync_log.transactions_added = total_added
            sync_log.transactions_updated = total_updated
            sync_log.status = 'success'

            # Actualizar last_synced_at
            connection.last_synced_at = timezone.now()
            connection.save(update_fields=['last_synced_at'])

            logger.info(
                "Sync completed: connection=%s accounts=%d "
                "tx_added=%d tx_updated=%d",
                connection.id, accounts_synced, total_added, total_updated,
            )

        except Exception as e:
            sync_log.status = 'error'
            sync_log.error_message = str(e)
            logger.error(
                "Sync failed: connection=%s error=%s",
                connection.id, str(e),
            )

        sync_log.completed_at = timezone.now()
        sync_log.save()
        return sync_log

    def _sync_accounts(self, connection: BankConnection) -> int:
        """
        Sincroniza cuentas desde el proveedor.
        Crea nuevas cuentas o actualiza las existentes.
        """
        provider_accounts: list[AccountInfo] = self.provider.get_accounts(
            connection.provider_connection_id,
        )
        synced = 0

        for acct_info in provider_accounts:
            bank_account, created = BankAccount.objects.update_or_create(
                external_account_id=acct_info.external_id,
                defaults={
                    'bank_connection': connection,
                    'iban': acct_info.iban or '',
                    'name': acct_info.name,
                    'currency': acct_info.currency,
                    'balance': acct_info.balance,
                    'balance_updated_at': timezone.now(),
                    'account_type': acct_info.account_type or '',
                },
            )

            # Guardar owner_name cifrado si está disponible
            if acct_info.owner_name:
                bank_account.owner_name = acct_info.owner_name
                bank_account.save(update_fields=['owner_name_encrypted'])

            # Vincular cuenta local en api.models.Account
            self._ensure_local_account(connection, bank_account)

            synced += 1
            action = "created" if created else "updated"
            logger.debug(
                "Account %s: %s (IBAN=%s)",
                action, bank_account.name, bank_account.iban,
            )

        return synced

    def _sync_transactions(
        self,
        connection: BankConnection,
        bank_account: BankAccount,
    ) -> tuple[int, int]:
        """
        Sincroniza transacciones para una cuenta.
        Usa deduplicación por external_transaction_id.
        Returns: (added_count, updated_count)
        """
        # Determinar fecha desde la cual buscar
        date_from = self._get_sync_start_date(bank_account)
        date_to = date.today()

        provider_transactions: list[TransactionInfo] = (
            self.provider.get_transactions(
                bank_account.external_account_id,
                date_from=date_from,
                date_to=date_to,
            )
        )

        added = 0
        updated = 0

        for tx_info in provider_transactions:
            existing = BankTransaction.objects.filter(
                bank_account=bank_account,
                external_transaction_id=tx_info.external_id,
            ).first()

            if existing:
                # Actualizar si cambió algún dato (ej. booking_date pendiente)
                changed = False
                if existing.amount != tx_info.amount:
                    existing.amount = tx_info.amount
                    changed = True
                if existing.description != tx_info.description:
                    existing.description = tx_info.description
                    changed = True
                if tx_info.merchant_name and existing.merchant_name != tx_info.merchant_name:
                    existing.merchant_name = tx_info.merchant_name
                    changed = True

                if changed:
                    existing.save()
                    updated += 1
            else:
                # Crear nueva transacción — deduplicación por unique_together
                try:
                    BankTransaction.objects.create(
                        bank_account=bank_account,
                        external_transaction_id=tx_info.external_id,
                        booking_date=tx_info.booking_date,
                        value_date=tx_info.value_date,
                        amount=tx_info.amount,
                        currency=tx_info.currency,
                        description=tx_info.description,
                        merchant_name=tx_info.merchant_name or '',
                        category_code=tx_info.category_code or '',
                        raw_data=tx_info.raw_data,
                    )
                    added += 1
                except IntegrityError:
                    # Duplicado detectado por constraint — ignorar
                    logger.debug(
                        "Duplicate transaction skipped: %s",
                        tx_info.external_id,
                    )

        return added, updated

    def _get_sync_start_date(self, bank_account: BankAccount) -> date:
        """
        Determina la fecha de inicio para buscar transacciones.
        Si hay transacciones previas, busca desde la última fecha - 3 días
        (margen de seguridad para transacciones con valor fecha retrasado).
        """
        latest_tx = (
            BankTransaction.objects
            .filter(bank_account=bank_account)
            .order_by('-booking_date')
            .first()
        )

        if latest_tx:
            # 3 días de margen para captar transacciones retrasadas
            return latest_tx.booking_date - timedelta(days=3)

        # Primera sincronización: últimos 90 días
        return date.today() - timedelta(days=90)

    # Mapeo de comercios y conceptos frecuentes a categorías (objetivo, fallback)
    MERCHANT_CATEGORY_MAP = {
        'mercadona': ('supermercado', 'alimentación'),
        'carrefour': ('supermercado', 'alimentación'),
        'lidl': ('supermercado', 'alimentación'),
        'dia': ('supermercado', 'alimentación'),
        'eroski': ('supermercado', 'alimentación'),
        'alcampo': ('supermercado', 'alimentación'),
        'consum': ('supermercado', 'alimentación'),
        'supercor': ('supermercado', 'alimentación'),
        'glovo': ('restaurantes', 'alimentación'),
        'just eat': ('restaurantes', 'alimentación'),
        'uber eats': ('restaurantes', 'alimentación'),
        'burger king': ('restaurantes', 'alimentación'),
        'mcdonald': ('restaurantes', 'alimentación'),
        'starbucks': ('restaurantes', 'ocio'),
        'repsol': ('gasolina', 'transporte'),
        'cepsa': ('gasolina', 'transporte'),
        'bp': ('gasolina', 'transporte'),
        'galp': ('gasolina', 'transporte'),
        'shell': ('gasolina', 'transporte'),
        'uber': ('transporte', None),
        'cabify': ('transporte', None),
        'renfe': ('transporte', None),
        'metro': ('transporte', None),
        'zara': ('ropa', None),
        'decathlon': ('ropa', 'ocio'),
        'h&m': ('ropa', None),
        'mango': ('ropa', None),
        'pull&bear': ('ropa', None),
        'massimo dutti': ('ropa', None),
        'bershka': ('ropa', None),
        'stradivarius': ('ropa', None),
        'primark': ('ropa', None),
        'netflix': ('suscripciones', 'ocio'),
        'spotify': ('suscripciones', 'ocio'),
        'hbo': ('suscripciones', 'ocio'),
        'disney': ('suscripciones', 'ocio'),
        'amazon prime': ('suscripciones', 'ocio'),
        'amazon': ('otros gastos', 'hogar'),
        'el corte inglés': ('otros gastos', 'hogar'),
        'ikea': ('hogar', None),
        'leroy merlin': ('hogar', None),
        'iberdrola': ('hogar', None),
        'endesa': ('hogar', None),
        'naturgy': ('hogar', None),
        'vodafone': ('hogar', 'suscripciones'),
        'movistar': ('hogar', 'suscripciones'),
        'orange': ('hogar', 'suscripciones'),
        'empresa sl': ('nómina', 'otros ingresos'),
        'nomina': ('nómina', 'otros ingresos'),
    }

    CODE_CATEGORY_MAP = {
        'GROCERIES': ('supermercado', 'alimentación'),
        'DINING': ('restaurantes', 'alimentación'),
        'TRANSPORT': ('transporte', 'gasolina'),
        'SHOPPING': ('ropa', 'otros gastos'),
        'UTILITIES': ('hogar', None),
        'ENTERTAINMENT': ('ocio', 'suscripciones'),
        'INCOME': ('nómina', 'otros ingresos'),
    }

    def _ensure_local_account(
        self,
        connection: BankConnection,
        bank_account: BankAccount,
    ) -> Account:
        """
        Asegura que la BankAccount tenga asociada una api.models.Account.
        """
        if bank_account.account:
            return bank_account.account

        inst_name = connection.institution_name or ''
        acct_name = bank_account.name or 'Cuenta'
        if inst_name and not acct_name.startswith(inst_name):
            full_name = f"{inst_name} - {acct_name}"
        else:
            full_name = acct_name

        local_account = Account.objects.filter(
            user=connection.user,
            name__in=[full_name, acct_name],
        ).first()

        if not local_account:
            local_account = Account.objects.create(
                user=connection.user,
                name=full_name,
                bank_name=inst_name,
                currency=bank_account.currency or 'EUR',
                initial_balance=Decimal('0.00'),
            )

        bank_account.account = local_account
        bank_account.save(update_fields=['account'])
        return local_account

    def _map_category(
        self,
        user: User,
        category_code: str,
        merchant: str,
        description: str,
        amount: Decimal,
        rules: list,
        categories_by_name: dict[str, Category],
    ) -> Category | None:
        """Determina la categoría más apropiada para una transacción bancaria."""
        # 1. Reglas explícitas o aprendizaje previo
        search_desc = f"{merchant or ''} {description or ''}".strip()
        learned = find_category_by_learning(user, search_desc, rules)
        if learned:
            return learned

        # 2. Mapeo por comercio o palabras clave conocidas
        search_text = search_desc.lower()
        for kw, (cat_target, cat_fallback) in self.MERCHANT_CATEGORY_MAP.items():
            if kw in search_text:
                if cat_target and cat_target in categories_by_name:
                    return categories_by_name[cat_target]
                if cat_fallback and cat_fallback in categories_by_name:
                    return categories_by_name[cat_fallback]

        # 3. Mapeo por código de categoría del banco/proveedor
        code = (category_code or '').upper()
        if code in self.CODE_CATEGORY_MAP:
            cat_target, cat_fallback = self.CODE_CATEGORY_MAP[code]
            if cat_target and cat_target in categories_by_name:
                return categories_by_name[cat_target]
            if cat_fallback and cat_fallback in categories_by_name:
                return categories_by_name[cat_fallback]

        # 4. Fallback por tipo de ingreso/gasto
        if amount >= 0:
            return categories_by_name.get('nómina') or categories_by_name.get('otros ingresos')
        else:
            return categories_by_name.get('otros gastos')

    def _link_and_copy_transactions(self, connection: BankConnection) -> int:
        """
        Copia las transacciones bancarias (BankTransaction) no vinculadas
        hacia api.models.Transaction, asignando categorías y cuenta local.
        """
        user = connection.user
        rules = list(ClassificationRule.objects.filter(user=user))
        categories = list(Category.objects.filter(user=user).select_related('parent'))
        categories_by_name = {c.name.lower(): c for c in categories}

        copied_or_linked = 0

        for bank_account in connection.bank_accounts.all():
            local_account = self._ensure_local_account(connection, bank_account)

            unlinked_txs = BankTransaction.objects.filter(
                bank_account=bank_account,
                transaction__isnull=True,
            )

            for bt in unlinked_txs:
                # 1. Comprobar si ya existe una transacción idéntica en la cuenta local
                existing_tx = Transaction.objects.filter(
                    user=user,
                    account=local_account,
                    metadata__external_id=bt.external_transaction_id,
                ).first()

                if not existing_tx:
                    existing_tx = Transaction.objects.filter(
                        user=user,
                        account=local_account,
                        date=bt.booking_date,
                        amount=bt.amount,
                        description=bt.description,
                    ).first()

                if existing_tx:
                    bt.transaction = existing_tx
                    bt.save(update_fields=['transaction'])
                    copied_or_linked += 1
                    continue

                # 2. Asignar categoría
                category = self._map_category(
                    user=user,
                    category_code=bt.category_code,
                    merchant=bt.merchant_name,
                    description=bt.description,
                    amount=bt.amount,
                    rules=rules,
                    categories_by_name=categories_by_name,
                )

                # 3. Crear Transaction en api.models
                tx_type = 'income' if bt.amount >= 0 else 'expense'
                new_tx = Transaction.objects.create(
                    user=user,
                    account=local_account,
                    category=category,
                    date=bt.booking_date,
                    description=bt.description,
                    amount=bt.amount,
                    type=tx_type,
                    raw_data=bt.description,
                    metadata={
                        'source': 'Open Banking',
                        'institution': connection.institution_name,
                        'merchant': bt.merchant_name or '',
                        'category_code': bt.category_code or '',
                        'external_id': bt.external_transaction_id,
                        'bank_transaction_id': bt.id,
                    },
                    is_pending=category is None,
                )

                bt.transaction = new_tx
                bt.save(update_fields=['transaction'])
                copied_or_linked += 1

        logger.info(
            "Linked and copied %d transactions for connection %s",
            copied_or_linked, connection.id,
        )
        return copied_or_linked

