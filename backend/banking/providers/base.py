from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any

@dataclass
class InstitutionInfo:
    """Información de una institución bancaria."""
    id: str
    name: str
    logo_url: str = ''
    country: str = 'ES'

@dataclass  
class ConnectionResult:
    """Resultado de iniciar una conexión bancaria."""
    connection_id: str
    authorization_url: str
    status: str = 'pending'

@dataclass
class AccountInfo:
    """Información de una cuenta bancaria."""
    external_id: str
    iban: str
    name: str
    currency: str
    balance: Decimal
    owner_name: str = ''
    account_type: str = ''

@dataclass
class TransactionInfo:
    """Información de una transacción bancaria."""
    external_id: str
    booking_date: date
    value_date: Optional[date]
    amount: Decimal
    currency: str
    description: str
    merchant_name: str = ''
    category_code: str = ''
    raw_data: Optional[Dict[str, Any]] = None

class BankingProvider(ABC):
    """Clase base abstracta para los proveedores de open banking."""
    
    @abstractmethod
    def get_institutions(self) -> List[InstitutionInfo]: ...
    
    @abstractmethod  
    def create_connection(self, institution_id: str, redirect_url: str) -> ConnectionResult: ...
    
    @abstractmethod
    def handle_callback(self, connection_id: str, callback_params: Dict[str, Any]) -> Dict[str, Any]: ...
    
    @abstractmethod
    def get_accounts(self, connection_id: str) -> List[AccountInfo]: ...
    
    @abstractmethod
    def get_transactions(self, account_external_id: str, date_from: Optional[date] = None, date_to: Optional[date] = None) -> List[TransactionInfo]: ...
    
    @abstractmethod
    def disconnect(self, connection_id: str) -> bool: ...
    
    @abstractmethod
    def refresh_connection(self, connection_id: str) -> bool: ...
