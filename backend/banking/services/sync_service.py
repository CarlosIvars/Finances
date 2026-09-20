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

