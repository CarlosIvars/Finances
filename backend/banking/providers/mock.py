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
        is_savings = account_external_id.endswith('_2') or 'savings' in account_external_id.lower()
        is_credit = account_external_id.endswith('_3') or 'credit' in account_external_id.lower()

        if is_savings:
            # Cuenta Ahorro: intereses y traspasos
            current_date = date_to
            while current_date >= date_from and len(transactions) < 20:
                if current_date.day == 1:
                    tx_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{account_external_id}_{current_date}_intereses"))
                    transactions.append(TransactionInfo(
                        external_id=tx_id,
                        booking_date=current_date,
                        value_date=current_date,
                        amount=Decimal("15.50"),
                        currency="EUR",
                        description="Liquidación de intereses",
                        merchant_name="Banco Sabadell",
                        category_code="INCOME"
                    ))
                elif current_date.day == 28:
                    tx_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{account_external_id}_{current_date}_traspaso_in"))
                    transactions.append(TransactionInfo(
                        external_id=tx_id,
                        booking_date=current_date,
                        value_date=current_date,
                        amount=Decimal("400.00"),
                        currency="EUR",
                        description="Traspaso recibido de Cuenta Nómina",
                        merchant_name="Traspaso interno",
                        category_code="INCOME"
                    ))
                current_date -= timedelta(days=1)

            return transactions

        if is_credit:
            # Tarjeta de Crédito: compras de ocio, moda, restaurantes y gasolina
            card_merchants = [
                ("Zara", -65, -20, "SHOPPING"),
                ("Glovo", -32, -15, "DINING"),
                ("Repsol", -75, -35, "TRANSPORT"),
                ("Uber", -25, -10, "TRANSPORT"),
                ("Netflix", -17, -17, "ENTERTAINMENT"),
                ("Spotify", -11, -11, "ENTERTAINMENT"),
                ("Decathlon", -85, -25, "SHOPPING"),
                ("El Corte Inglés", -120, -45, "SHOPPING"),
            ]
            current_date = date_to
            while current_date >= date_from and len(transactions) < 35:
                # 1 compra cada 2 días
                if current_date.day % 2 == 0:
                    idx = (current_date.day // 2) % len(card_merchants)
                    merchant, min_amt, max_amt, cat = card_merchants[idx]
                    fixed_amt = Decimal(str(min_amt + (abs(max_amt - min_amt) // 2))) + Decimal("0.50")
                    tx_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{account_external_id}_{current_date}_{merchant}"))
                    transactions.append(TransactionInfo(
                        external_id=tx_id,
                        booking_date=current_date,
                        value_date=current_date,
                        amount=fixed_amt,
                        currency="EUR",
                        description=f"Compra con tarjeta en {merchant}",
                        merchant_name=merchant,
                        category_code=cat
                    ))
                current_date -= timedelta(days=1)

            return transactions

        # Cuenta Nómina (Checking): nómina, recibos domésticos, supermercados y transferencias
        checking_merchants = [
            ("Mercadona", -110, -40, "GROCERIES"),
            ("Iberdrola", -95, -60, "UTILITIES"),
            ("Vodafone", -55, -35, "UTILITIES"),
            ("Carrefour", -130, -50, "GROCERIES"),
            ("Lidl", -70, -30, "GROCERIES"),
            ("IKEA", -210, -80, "SHOPPING"),
        ]

        current_date = date_to
        while current_date >= date_from and len(transactions) < 40:
            if current_date.day == 28:
                tx_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{account_external_id}_{current_date}_nomina"))
                transactions.append(TransactionInfo(
                    external_id=tx_id,
                    booking_date=current_date,
                    value_date=current_date,
                    amount=Decimal("2850.00"),
                    currency="EUR",
                    description="Nómina",
                    merchant_name="Empresa SL",
                    category_code="INCOME"
                ))
            elif current_date.day == 29:
                tx_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{account_external_id}_{current_date}_traspaso_out"))
                transactions.append(TransactionInfo(
                    external_id=tx_id,
                    booking_date=current_date,
                    value_date=current_date,
                    amount=Decimal("-400.00"),
                    currency="EUR",
                    description="Traspaso enviado a Cuenta Ahorro",
                    merchant_name="Traspaso interno",
                    category_code="SHOPPING"
                ))

            if current_date.day % 3 == 0:
                idx = (current_date.day // 3) % len(checking_merchants)
                merchant, min_amt, max_amt, cat = checking_merchants[idx]
                fixed_amt = Decimal(str(min_amt + (abs(max_amt - min_amt) // 2))) + Decimal("0.50")
                tx_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{account_external_id}_{current_date}_{merchant}"))
                transactions.append(TransactionInfo(
                    external_id=tx_id,
                    booking_date=current_date,
                    value_date=current_date,
                    amount=fixed_amt,
                    currency="EUR",
                    description=f"Adeudo {merchant}",
                    merchant_name=merchant,
                    category_code=cat
                ))

            current_date -= timedelta(days=1)

        return transactions

    def disconnect(self, connection_id: str) -> bool:
        return True

    def refresh_connection(self, connection_id: str) -> bool:
        return True
