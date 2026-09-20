from __future__ import annotations

"""
Servicio de conexión bancaria Open Banking.
Gestiona el ciclo de vida de las conexiones: crear, callback, desconectar.
"""
import logging
from django.utils import timezone
from django.contrib.auth.models import User

from banking.models import BankConnection, BankAccount, SyncLog
from banking.providers import get_provider

logger = logging.getLogger('banking')


class ConnectionService:
    """Gestiona conexiones bancarias Open Banking."""

    def __init__(self):
        self.provider = get_provider()

    def get_available_institutions(self) -> list[dict]:
        """Devuelve la lista de instituciones bancarias disponibles."""
        institutions = self.provider.get_institutions()
        return [
            {
                'id': inst.id,
                'name': inst.name,
                'logo_url': inst.logo_url,
                'country': inst.country,
            }
            for inst in institutions
        ]

    def create_connection(
        self,
        user: User,
        institution_id: str,
        redirect_url: str,
    ) -> dict:
        """
        Inicia una nueva conexión bancaria.
        Returns: {connection_id, authorization_url, status}
        """
        # Buscar nombre de la institución
        institutions = self.provider.get_institutions()
        institution_name = institution_id
        for inst in institutions:
            if inst.id == institution_id:
                institution_name = inst.name
                break

        # Crear conexión en proveedor externo
        result = self.provider.create_connection(institution_id, redirect_url)

        # Crear registro en DB
        connection = BankConnection.objects.create(
            user=user,
            provider=self._get_provider_name(),
            provider_connection_id=result.connection_id,
            institution_id=institution_id,
            institution_name=institution_name,
            status='pending',
        )

        logger.info(
            "Banking connection created: user=%s institution=%s connection=%s",
            user.id, institution_id, connection.id,
        )

        return {
            'connection_id': connection.id,
            'provider_connection_id': result.connection_id,
            'authorization_url': result.authorization_url,
            'status': 'pending',
        }

    def handle_callback(
        self,
        provider_connection_id: str,
        callback_params: dict,
    ) -> BankConnection:
        """
        Procesa el callback del banco tras la autorización del usuario.
        Actualiza la conexión con tokens y estado.
        """
        connection = BankConnection.objects.get(
            provider_connection_id=provider_connection_id,
        )

        # Procesar callback en el proveedor
        result = self.provider.handle_callback(
            provider_connection_id, callback_params,
        )

        # Actualizar conexión con tokens
        if result.get('access_token'):
            connection.access_token = result['access_token']
        if result.get('refresh_token'):
            connection.refresh_token = result['refresh_token']
        if result.get('consent_id'):
            connection.consent_id = result['consent_id']
        if result.get('consent_expires_at'):
            connection.consent_expires_at = result['consent_expires_at']

        connection.status = 'active'
        connection.save()

        logger.info(
            "Banking connection activated: connection=%s institution=%s",
            connection.id, connection.institution_id,
        )

        return connection

    def disconnect(self, connection: BankConnection) -> bool:
        """
        Desconecta una conexión bancaria: revoca consentimiento y
        marca como revocada.
        """
        try:
            if connection.provider_connection_id:
                self.provider.disconnect(connection.provider_connection_id)
        except Exception as e:
            logger.warning(
                "Error disconnecting from provider: connection=%s error=%s",
                connection.id, str(e),
            )

        connection.status = 'revoked'
        connection.access_token = None
        connection.refresh_token = None
        connection.save()

        logger.info(
            "Banking connection revoked: connection=%s",
            connection.id,
        )
        return True

    def get_user_connections(self, user: User) -> list[BankConnection]:
        """Devuelve todas las conexiones del usuario."""
        return list(
            BankConnection.objects.filter(user=user)
            .select_related('user')
            .prefetch_related('bank_accounts')
        )

    def _get_provider_name(self) -> str:
        """Devuelve el nombre del proveedor configurado."""
        import os
        return os.environ.get('BANKING_PROVIDER', 'mock')

