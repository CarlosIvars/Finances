"""
Tests para los modelos de la app banking.
"""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone

from banking.models import BankConnection, BankAccount, BankTransaction, SyncLog


class BankConnectionModelTest(TestCase):
    """Tests del modelo BankConnection."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
        )

    def test_create_connection(self):
        conn = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='pending',
        )
        self.assertEqual(conn.user, self.user)
        self.assertEqual(conn.provider, 'mock')
        self.assertEqual(conn.status, 'pending')
        self.assertFalse(conn.is_consent_valid())

    def test_active_connection_valid_consent(self):
        conn = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='active',
            consent_expires_at=timezone.now() + timedelta(days=90),
        )
        self.assertTrue(conn.is_consent_valid())

    def test_expired_connection_invalid_consent(self):
        conn = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='active',
            consent_expires_at=timezone.now() - timedelta(days=1),
        )
        self.assertFalse(conn.is_consent_valid())

    def test_revoked_connection_invalid(self):
        conn = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='revoked',
        )
        self.assertFalse(conn.is_consent_valid())

    def test_token_encryption(self):
        conn = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
        )
        test_token = 'super-secret-access-token-12345'
        conn.access_token = test_token
        conn.save()

        # Reload from DB
        conn.refresh_from_db()
        self.assertEqual(conn.access_token, test_token)
        # Encrypted value should be different from plaintext
        self.assertNotEqual(conn.access_token_encrypted, test_token.encode())


class BankAccountModelTest(TestCase):
    """Tests del modelo BankAccount."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
        )
        self.connection = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='active',
        )

    def test_create_account(self):
        account = BankAccount.objects.create(
            bank_connection=self.connection,
            external_account_id='ext-acct-001',
            iban='ES1234567890123456789012',
            name='Cuenta Corriente',
            currency='EUR',
            balance=Decimal('1500.50'),
        )
        self.assertEqual(account.iban, 'ES1234567890123456789012')
        self.assertEqual(account.balance, Decimal('1500.50'))

    def test_owner_name_encryption(self):
        account = BankAccount.objects.create(
            bank_connection=self.connection,
            external_account_id='ext-acct-002',
            name='Cuenta Corriente',
        )
        account.owner_name = 'Juan García López'
        account.save()

        account.refresh_from_db()
        self.assertEqual(account.owner_name, 'Juan García López')


class BankTransactionModelTest(TestCase):
    """Tests del modelo BankTransaction."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
        )
        self.connection = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
            status='active',
        )
        self.bank_account = BankAccount.objects.create(
            bank_connection=self.connection,
            external_account_id='ext-acct-001',
            name='Cuenta Corriente',
        )

    def test_create_transaction(self):
        tx = BankTransaction.objects.create(
            bank_account=self.bank_account,
            external_transaction_id='tx-001',
            booking_date=timezone.now().date(),
            amount=Decimal('-42.50'),
            currency='EUR',
            description='Mercadona Supermercado',
            merchant_name='Mercadona',
        )
        self.assertEqual(tx.amount, Decimal('-42.50'))
        self.assertEqual(tx.merchant_name, 'Mercadona')

    def test_unique_constraint_deduplication(self):
        """external_transaction_id + bank_account debe ser único."""
        BankTransaction.objects.create(
            bank_account=self.bank_account,
            external_transaction_id='tx-unique-001',
            booking_date=timezone.now().date(),
            amount=Decimal('-10.00'),
            currency='EUR',
            description='Test',
        )

        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            BankTransaction.objects.create(
                bank_account=self.bank_account,
                external_transaction_id='tx-unique-001',
                booking_date=timezone.now().date(),
                amount=Decimal('-10.00'),
                currency='EUR',
                description='Test Duplicate',
            )


class SyncLogModelTest(TestCase):
    """Tests del modelo SyncLog."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass123',
        )
        self.connection = BankConnection.objects.create(
            user=self.user,
            provider='mock',
            institution_id='sabadell',
            institution_name='Banco Sabadell',
        )

    def test_create_sync_log(self):
        log = SyncLog.objects.create(
            bank_connection=self.connection,
            sync_type='manual',
            status='running',
        )
        self.assertEqual(log.status, 'running')
        self.assertEqual(log.transactions_added, 0)

