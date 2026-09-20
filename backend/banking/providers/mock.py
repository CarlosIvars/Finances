import uuid
import random
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any

from .base import (
    BankingProvider,
    InstitutionInfo,
    ConnectionResult,
    AccountInfo,
    TransactionInfo
)

class MockProvider(BankingProvider):
    """Proveedor mock para pruebas, devuelve datos realistas de España."""

    def get_institutions(self) -> List[InstitutionInfo]:
        return [
            InstitutionInfo(id="sabadell", name="Banco Sabadell", logo_url="https://example.com/sabadell.png"),
            InstitutionInfo(id="bbva", name="BBVA", logo_url="https://example.com/bbva.png"),
            InstitutionInfo(id="santander", name="Banco Santander", logo_url="https://example.com/santander.png"),
            InstitutionInfo(id="caixabank", name="CaixaBank", logo_url="https://example.com/caixa.png"),
            InstitutionInfo(id="ing", name="ING España", logo_url="https://example.com/ing.png"),
            InstitutionInfo(id="revolut", name="Revolut", logo_url="https://example.com/revolut.png"),
        ]

    def create_connection(self, institution_id: str, redirect_url: str) -> ConnectionResult:
        connection_id = str(uuid.uuid4())
        return ConnectionResult(
            connection_id=connection_id,
            authorization_url=f"https://mock-bank.local/auth?id={connection_id}&redirect={redirect_url}"
        )

    def handle_callback(self, connection_id: str, callback_params: Dict[str, Any]) -> Dict[str, Any]:
        from datetime import datetime, timezone as tz
        return {
            "status": "success",
            "access_token": f"mock_access_{connection_id}",
            "refresh_token": f"mock_refresh_{connection_id}",
            "consent_id": f"mock_consent_{connection_id}",
            "consent_expires_at": datetime.now(tz.utc) + timedelta(days=90),
        }

    def get_accounts(self, connection_id: str) -> List[AccountInfo]:
        return [
            AccountInfo(
                external_id=f"acc_{connection_id}_1",
                iban="ES9121000418401234567890",
                name="Cuenta Nómina",
                currency="EUR",
                balance=Decimal("2450.75"),
                owner_name="Usuario de Prueba",
                account_type="CHECKING"
            ),
            AccountInfo(
                external_id=f"acc_{connection_id}_2",
                iban="ES9121000418401234567891",
                name="Cuenta Ahorro",
                currency="EUR",
                balance=Decimal("15200.00"),
                owner_name="Usuario de Prueba",
                account_type="SAVINGS"
            ),
            AccountInfo(
                external_id=f"acc_{connection_id}_3",
                iban="",
                name="Tarjeta de Crédito Visa",
                currency="EUR",
                balance=Decimal("-345.20"),
                owner_name="Usuario de Prueba",
                account_type="CREDIT"
            )
        ]

    def get_transactions(self, account_external_id: str, date_from: Optional[date] = None, date_to: Optional[date] = None) -> List[TransactionInfo]:
        if not date_to:
            date_to = date.today()
        if not date_from:
            date_from = date_to - timedelta(days=90)

        transactions = []
        merchants = [
            ("Mercadona", -150, -30, "GROCERIES"),
            ("El Corte Inglés", -200, -50, "SHOPPING"),
            ("Iberdrola", -120, -50, "UTILITIES"),
            ("Vodafone", -80, -40, "UTILITIES"),
            ("Repsol", -90, -40, "TRANSPORT"),
            ("Zara", -150, -20, "SHOPPING"),
            ("Glovo", -45, -15, "DINING"),
            ("Uber", -35, -10, "TRANSPORT"),
            ("Netflix", -15, -10, "ENTERTAINMENT"),
            ("Spotify", -15, -10, "ENTERTAINMENT"),
            ("Amazon", -150, -20, "SHOPPING"),
            ("Carrefour", -180, -40, "GROCERIES"),
            ("Lidl", -80, -20, "GROCERIES"),
            ("Decathlon", -120, -30, "SHOPPING"),
            ("IKEA", -300, -50, "SHOPPING"),
        ]

        current_date = date_to
        while current_date >= date_from and len(transactions) < 50:
            # Añadir nómina una vez al mes
            if current_date.day == 28:
                salary_amount = Decimal("2850.00")
                tx_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{account_external_id}_{current_date}_nomina"))
                transactions.append(TransactionInfo(
                    external_id=tx_id,
                    booking_date=current_date,
                    value_date=current_date,
                    amount=salary_amount,
                    currency="EUR",
                    description="Nómina",
                    merchant_name="Empresa SL",
                    category_code="INCOME"
                ))

            # Añadir transacciones deterministas según la fecha
            # Usar el día del mes para seleccionar comerciantes
            day_mod = current_date.day % len(merchants)
            merchant, min_amt, max_amt, cat = merchants[day_mod]
            fixed_amt = Decimal(str(min_amt + (abs(max_amt - min_amt) // 2))) + Decimal("0.50")
            
            tx_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{account_external_id}_{current_date}_{merchant}"))
            transactions.append(TransactionInfo(
                external_id=tx_id,
                booking_date=current_date,
                value_date=current_date,
                amount=fixed_amt,
                currency="EUR",
                description=f"Compra en {merchant}",
                merchant_name=merchant,
                category_code=cat
            ))
                
            current_date -= timedelta(days=1)

        return transactions[:50]

    def disconnect(self, connection_id: str) -> bool:
        return True

    def refresh_connection(self, connection_id: str) -> bool:
        return True
