"""
Tests para los providers de banking.
"""
from datetime import date
from decimal import Decimal

from django.test import TestCase

from banking.providers.base import BankingProvider
from banking.providers.mock import MockProvider


class MockProviderTest(TestCase):
    """Tests del MockProvider."""

    def setUp(self):
        self.provider = MockProvider()

    def test_get_institutions(self):
        institutions = self.provider.get_institutions()
        self.assertGreaterEqual(len(institutions), 6)

        # Verificar que Sabadell está incluido
        ids = [inst.id for inst in institutions]
        self.assertIn('sabadell', ids)
        self.assertIn('bbva', ids)
        self.assertIn('santander', ids)
        self.assertIn('caixabank', ids)

        # Verificar que todos tienen nombre y país
        for inst in institutions:
            self.assertTrue(inst.name)
            self.assertEqual(inst.country, 'ES')

    def test_create_connection(self):
        result = self.provider.create_connection(
            'sabadell', 'http://localhost/callback',
        )
        self.assertTrue(result.connection_id)
        self.assertTrue(result.authorization_url)
        self.assertEqual(result.status, 'pending')

    def test_handle_callback(self):
        # First create a connection
        conn = self.provider.create_connection(
            'sabadell', 'http://localhost/callback',
        )
        result = self.provider.handle_callback(
            conn.connection_id, {'code': 'test'},
        )
        self.assertIn('access_token', result)
        self.assertIn('refresh_token', result)
        self.assertIn('consent_id', result)

    def test_get_accounts(self):
        conn = self.provider.create_connection(
            'sabadell', 'http://localhost/callback',
        )
        accounts = self.provider.get_accounts(conn.connection_id)
        self.assertGreaterEqual(len(accounts), 2)

        # Verificar estructura de cuentas
        for acct in accounts:
            self.assertTrue(acct.external_id)
            self.assertTrue(acct.name)
            self.assertEqual(acct.currency, 'EUR')
            self.assertIsInstance(acct.balance, Decimal)

        # Al menos una cuenta debe tener IBAN
        ibans = [a.iban for a in accounts if a.iban]
        self.assertGreater(len(ibans), 0)
        # IBAN español empieza por ES
        self.assertTrue(any(iban.startswith('ES') for iban in ibans))

    def test_get_transactions(self):
        conn = self.provider.create_connection(
            'sabadell', 'http://localhost/callback',
        )
        accounts = self.provider.get_accounts(conn.connection_id)
        account = accounts[0]

        transactions = self.provider.get_transactions(
            account.external_id,
            date_from=date(2026, 6, 1),
            date_to=date(2026, 9, 20),
        )

        self.assertGreater(len(transactions), 0)

        # Verificar estructura
        for tx in transactions:
            self.assertTrue(tx.external_id)
            self.assertIsInstance(tx.booking_date, date)
            self.assertIsInstance(tx.amount, Decimal)
            self.assertTrue(tx.description)
            self.assertEqual(tx.currency, 'EUR')

        # Debe haber mix de ingresos y gastos
        amounts = [tx.amount for tx in transactions]
        has_positive = any(a > 0 for a in amounts)
        has_negative = any(a < 0 for a in amounts)
        self.assertTrue(has_positive, "Debe haber al menos un ingreso")
        self.assertTrue(has_negative, "Debe haber al menos un gasto")

    def test_get_transactions_unique_ids(self):
        """Todas las transacciones deben tener IDs únicos."""
        conn = self.provider.create_connection(
            'sabadell', 'http://localhost/callback',
        )
        accounts = self.provider.get_accounts(conn.connection_id)
        transactions = self.provider.get_transactions(
            accounts[0].external_id,
        )
        ids = [tx.external_id for tx in transactions]
        self.assertEqual(len(ids), len(set(ids)), "Transaction IDs must be unique")

    def test_disconnect(self):
        conn = self.provider.create_connection(
            'sabadell', 'http://localhost/callback',
        )
        result = self.provider.disconnect(conn.connection_id)
        self.assertTrue(result)

    def test_refresh_connection(self):
        conn = self.provider.create_connection(
            'sabadell', 'http://localhost/callback',
        )
        result = self.provider.refresh_connection(conn.connection_id)
        self.assertTrue(result)

    def test_is_banking_provider(self):
        """MockProvider implementa la interfaz BankingProvider."""
        self.assertIsInstance(self.provider, BankingProvider)

