import io
from datetime import date, datetime, timezone
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from api.models import Account, Category, Transaction, Alert
from api.tax_service import get_tax_summary, export_tax_excel, export_tax_csv, ensure_system_presets
from documents.models import Document, GmailAccount
from documents.storage import LocalStorageManager, get_storage_manager
from documents.matcher_service import MatcherService


class TaxServiceTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='fiscal_user', email='fiscal@example.com', password='Password123!')
        self.account = Account.objects.create(user=self.user, name="Cuenta Principal")
        
        # Categorías fiscales
        self.cat_salary = Category.objects.create(user=self.user, name="Nómina", aeat_code="TRABAJO_0001", is_income=True)
        self.cat_donation = Category.objects.create(user=self.user, name="Donaciones ONG", aeat_code="DONACION_0722", tax_deductible=True, is_income=False)
        self.cat_mortgage = Category.objects.create(user=self.user, name="Hipoteca Vivienda", aeat_code="HIPOTECA_0698", tax_deductible=True, is_income=False)
        self.cat_rent = Category.objects.create(user=self.user, name="Alquiler Vivienda", aeat_code="ALQUILER_0102", tax_deductible=True, is_income=False)

    def test_tax_summary_and_deductions(self):
        # Transacciones de 2025
        Transaction.objects.create(user=self.user, account=self.account, category=self.cat_salary, date=date(2025, 1, 30), description="Nómina Enero", amount=Decimal('2500.00'), type='income', tax_year=2025)
        Transaction.objects.create(user=self.user, account=self.account, category=self.cat_donation, date=date(2025, 3, 15), description="Donación Cruz Roja", amount=Decimal('-300.00'), type='expense', tax_year=2025)
        Transaction.objects.create(user=self.user, account=self.account, category=self.cat_mortgage, date=date(2025, 6, 1), description="Cuota Hipoteca", amount=Decimal('-6000.00'), type='expense', tax_year=2025)

        summary = get_tax_summary(self.user, 2025)
        metrics = summary['metrics']

        self.assertEqual(metrics['work_income'], 2500.0)
        self.assertEqual(metrics['donations_base'], 300.0)
        # Donación 300€: primeros 250€ al 80% (=200€) + 50€ al 40% (=20€) => Total 220€
        self.assertEqual(metrics['donations_deduction'], 220.0)
        # Hipoteca 6.000€: 15% de 6.000€ => 900€
        self.assertEqual(metrics['mortgage_base'], 6000.0)
        self.assertEqual(metrics['mortgage_deduction'], 900.0)

    def test_export_tax_excel_and_csv(self):
        Transaction.objects.create(user=self.user, account=self.account, category=self.cat_donation, date=date(2025, 3, 15), description="Donación Médicos Sin Fronteras", amount=Decimal('-150.00'), type='expense', tax_year=2025)
        
        excel_io = export_tax_excel(self.user, 2025)
        self.assertGreater(excel_io.getbuffer().nbytes, 1000)

        csv_io = export_tax_csv(self.user, 2025)
        csv_content = csv_io.getvalue()
        self.assertIn("Donación Médicos Sin Fronteras", csv_content)
        self.assertIn("DONACION_0722", csv_content)


class DocumentAndMatcherTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='doc_user', email='doc@example.com', password='Password123!')
        self.account = Account.objects.create(user=self.user, name="Cuenta Banco")
        self.storage = get_storage_manager()

    def test_local_storage_manager(self):
        content = b"%PDF-1.4 invoice dummy content"
        meta = self.storage.save_file(self.user.id, "factura_test.pdf", content, "application/pdf")
        
        self.assertIn("documents/", meta['storage_path'])
        self.assertEqual(meta['file_size'], len(content))
        self.assertTrue(meta['file_hash'])

        doc = Document.objects.create(
            user=self.user,
            storage_path=meta['storage_path'],
            file=meta['storage_path'],
            file_name=meta['file_name'],
            file_size=meta['file_size'],
            file_hash=meta['file_hash']
        )
        url = self.storage.get_url(doc)
        self.assertTrue(url.startswith('/media/documents/'))

    def test_exact_matcher_creates_alert(self):
        # Crear transacción bancaria
        tx = Transaction.objects.create(
            user=self.user,
            account=self.account,
            date=date(2025, 5, 10),
            description="Vodafone Servicios Telecom",
            amount=Decimal('-45.99'),
            type='expense'
        )

        # Crear documento con importe exacto y fecha cercana
        doc = Document.objects.create(
            user=self.user,
            file_name="Factura_Vodafone_Mayo.pdf",
            amount_hint=Decimal('45.99'),
            email_sender="facturas@vodafone.es",
            email_subject="Tu factura de Vodafone correspondiente a mayo",
            email_date=datetime(2025, 5, 11, 10, 0, tzinfo=timezone.utc),
            status='unmatched'
        )

        match_status = MatcherService.match_document(doc)
        self.assertEqual(match_status, 'auto_matched')
        doc.refresh_from_db()
        self.assertEqual(doc.transaction, tx)
        self.assertEqual(doc.status, 'auto_matched')

        # Verificar que se creó la Alerta de notificación
        alert = Alert.objects.filter(user=self.user, icon='📄').first()
        self.assertIsNotNone(alert)
        self.assertIn("Factura vinculada automáticamente", alert.title)
        self.assertIn("Vodafone Servicios Telecom", alert.message)

    def test_approximate_matcher_creates_suggestion(self):
        tx = Transaction.objects.create(
            user=self.user,
            account=self.account,
            date=date(2025, 5, 10),
            description="Iberdrola Clientes",
            amount=Decimal('-78.50'),
            type='expense'
        )

        # Documento sin amount_hint pero con emisor coincidente en +-7 días
        doc = Document.objects.create(
            user=self.user,
            file_name="Recibo_Electricidad_Iberdrola.pdf",
            email_sender="notificaciones@iberdrola.es",
            email_subject="Aviso de emisión de factura Iberdrola",
            email_date=datetime(2025, 5, 12, 10, 0, tzinfo=timezone.utc),
            status='unmatched'
        )

        match_status = MatcherService.match_document(doc)
        self.assertEqual(match_status, 'suggested')
        doc.refresh_from_db()
        self.assertEqual(doc.suggested_transaction, tx)
        self.assertIsNone(doc.transaction)

        # Confirmar sugerencia
        confirmed = MatcherService.confirm_match(doc, self.user)
        self.assertTrue(confirmed)
        doc.refresh_from_db()
        self.assertEqual(doc.transaction, tx)
        self.assertEqual(doc.status, 'confirmed')

    def test_gmail_account_encryption(self):
        gmail_acc = GmailAccount.objects.create(
            user=self.user,
            email="testuser@gmail.com"
        )
        gmail_acc.set_access_token("secret_access_token_123")
        gmail_acc.set_refresh_token("secret_refresh_token_456")
        gmail_acc.save()

        # En base de datos debe ser binario encriptado
        self.assertNotEqual(gmail_acc.access_token_encrypted, b"secret_access_token_123")
        # Al desencriptar se recupera el token original
        self.assertEqual(gmail_acc.get_access_token(), "secret_access_token_123")
        self.assertEqual(gmail_acc.get_refresh_token(), "secret_refresh_token_456")

    def test_isolated_document_parser_success(self):
        from documents.isolation import IsolatedDocumentParser
        content = b"%PDF-1.4 Invoice total: 125.50 EUR for services rendered"
        res = IsolatedDocumentParser.parse_file(content, "invoice.pdf")
        self.assertEqual(res.get('status'), 'success')
        self.assertIn("Invoice", res.get('text', ''))
        self.assertEqual(res.get('amount_hint'), 125.50)

    def test_isolated_document_parser_empty(self):
        from documents.isolation import IsolatedDocumentParser
        res = IsolatedDocumentParser.parse_file(b"", "empty.pdf")
        self.assertEqual(res.get('status'), 'empty')

