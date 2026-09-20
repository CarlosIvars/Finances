"""
Tests de deduplicación de transacciones bancarias.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone

from banking.models import BankConnection, BankAccount, BankTransaction
from banking.services.sync_service import SyncService


class DeduplicationTest(TestCase):
    """Tests del sistema de deduplicación de transacciones."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
        )
        self.connection = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            provider_connection_id='test-conn-001',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='active',
            consent_expires_at=timezone.now() + timedelta(days=90),
        )
        self.bank_account = BankAccount.objects.create(
            bank_connection=self.connection,
            external_account_id='mock-checking-001',
            iban='ES1234567890123456789012',
            name='Cuenta Corriente',
        )

    def test_first_sync_creates_all_transactions(self):
        """Primera sincronización debe crear todas las transacciones."""
        service = SyncService()
        sync_log = service.sync_connection(self.connection)

        self.assertEqual(sync_log.status, 'success')
        self.assertGreater(sync_log.transactions_added, 0)

        tx_count = BankTransaction.objects.filter(
            bank_account=self.bank_account,
        ).count()
        self.assertGreater(tx_count, 0)

    def test_second_sync_no_duplicates(self):
        """Segunda sincronización no debe crear duplicados."""
        service = SyncService()

        # Primera sync
        log1 = service.sync_connection(self.connection)
        count_after_first = BankTransaction.objects.filter(
            bank_account=self.bank_account,
        ).count()

        # Segunda sync
        log2 = service.sync_connection(self.connection)
        count_after_second = BankTransaction.objects.filter(
            bank_account=self.bank_account,
        ).count()

        # No deben haberse añadido nuevas transacciones
        self.assertEqual(count_after_first, count_after_second)
        self.assertEqual(log2.transactions_added, 0)

    def test_unique_external_ids_in_db(self):
        """Todos los external_transaction_id deben ser únicos por cuenta."""
        service = SyncService()
        service.sync_connection(self.connection)

        transactions = BankTransaction.objects.filter(
            bank_account=self.bank_account,
        ).values_list('external_transaction_id', flat=True)

        ids = list(transactions)
        self.assertEqual(len(ids), len(set(ids)), "IDs must be unique")


class SyncServiceTest(TestCase):
    """Tests del servicio de sincronización."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
        )

    def test_sync_invalid_connection_fails(self):
        """Sync con conexión expirada debe fallar."""
        connection = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            provider_connection_id='test-expired',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='expired',
        )

        service = SyncService()
        log = service.sync_connection(connection)

        self.assertEqual(log.status, 'error')
        self.assertTrue(log.error_message)

    def test_sync_creates_sync_log(self):
        """La sincronización siempre crea un SyncLog."""
        connection = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            provider_connection_id='test-log',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='active',
            consent_expires_at=timezone.now() + timedelta(days=90),
        )

        service = SyncService()
        log = service.sync_connection(connection, sync_type='manual')

        self.assertIsNotNone(log.id)
        self.assertEqual(log.sync_type, 'manual')
        self.assertIsNotNone(log.completed_at)

    def test_sync_updates_last_synced(self):
        """La sincronización actualiza last_synced_at."""
        connection = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            provider_connection_id='test-update',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='active',
            consent_expires_at=timezone.now() + timedelta(days=90),
        )

        self.assertIsNone(connection.last_synced_at)

        service = SyncService()
        service.sync_connection(connection)

        connection.refresh_from_db()
        self.assertIsNotNone(connection.last_synced_at)

