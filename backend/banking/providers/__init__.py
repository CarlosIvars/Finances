import os
from .base import BankingProvider

def get_provider() -> BankingProvider:
    """Devuelve la instancia del proveedor de open banking configurado."""
    provider_name = os.environ.get('BANKING_PROVIDER', 'mock').lower()
    
    if provider_name == 'mock':
        from .mock import MockProvider
        return MockProvider()
    
    # Aquí se podrían añadir más proveedores (ej. 'gocardless', 'saltedge', etc.)
    raise ValueError(f"Proveedor de banking desconocido: {provider_name}")
