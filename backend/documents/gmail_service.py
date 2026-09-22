import os
import re
import base64
import logging
import urllib.parse
from datetime import datetime, timezone, timedelta
import requests
from django.conf import settings
from .models import GmailAccount, Document
from .storage import get_storage_manager
from .matcher_service import MatcherService

logger = logging.getLogger('api')

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
]


class GmailSyncService:
    """Servicio para interactuar con la API de Gmail y sincronizar facturas."""

    @staticmethod
    def get_client_credentials():
        client_id = os.environ.get('GOOGLE_CLIENT_ID', getattr(settings, 'GOOGLE_CLIENT_ID', ''))
        client_secret = os.environ.get('GOOGLE_CLIENT_SECRET', getattr(settings, 'GOOGLE_CLIENT_SECRET', ''))
        return client_id, client_secret

    @classmethod
    def get_authorization_url(cls, redirect_uri: str, state: str = "") -> str:
        client_id, _ = cls.get_client_credentials()
        if not client_id:
            raise ValueError("GOOGLE_CLIENT_ID no está configurado en las variables de entorno.")

        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': " ".join(SCOPES),
            'access_type': 'offline',
            'prompt': 'consent',
            'include_granted_scopes': 'true',
        }
        if state:
            params['state'] = state
        return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"

    @classmethod
    def exchange_code_for_tokens(cls, code: str, redirect_uri: str, code_verifier: str = "") -> dict:
        client_id, client_secret = cls.get_client_credentials()
        if not client_id or not client_secret:
            raise ValueError("GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar configurados.")

        payload = {
            'code': code,
            'client_id': client_id,
            'client_secret': client_secret,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
        }
        if code_verifier:
            payload['code_verifier'] = code_verifier

        response = requests.post(
            GOOGLE_TOKEN_URL,
            data=payload,
            timeout=15
        )
        if not response.ok:
            logger.error(f"Error al intercambiar código OAuth: {response.text}")
            raise ValueError(f"Google OAuth Error: {response.json().get('error_description', response.text)}")
        return response.json()

    @classmethod
    def refresh_access_token(cls, gmail_account: GmailAccount) -> str:
        refresh_token = gmail_account.get_refresh_token()
        if not refresh_token:
            raise ValueError("No hay refresh_token guardado para esta cuenta de Gmail.")

        client_id, client_secret = cls.get_client_credentials()
        response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                'refresh_token': refresh_token,
                'client_id': client_id,
                'client_secret': client_secret,
                'grant_type': 'refresh_token',
            },
            timeout=15
        )
        if not response.ok:
            logger.error(f"Error refrescando token Gmail: {response.text}")
            raise ValueError("Error al refrescar credenciales de Google.")

        token_data = response.json()
        new_access_token = token_data['access_token']
        expires_in = token_data.get('expires_in', 3600)

        gmail_account.set_access_token(new_access_token)
        gmail_account.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        gmail_account.save(update_fields=['access_token_encrypted', 'token_expiry', 'updated_at'])
        return new_access_token

    @classmethod
    def get_valid_access_token(cls, gmail_account: GmailAccount) -> str:
        if gmail_account.token_expiry and gmail_account.token_expiry > datetime.now(timezone.utc) + timedelta(minutes=2):
            token = gmail_account.get_access_token()
            if token:
                return token
        return cls.refresh_access_token(gmail_account)

    @classmethod
    def get_user_email(cls, access_token: str) -> str:
        response = requests.get(
            GOOGLE_USERINFO_URL,
            headers={'Authorization': f"Bearer {access_token}"},
            timeout=10
        )
        if response.ok:
            return response.json().get('email', '')
        return ''

    @classmethod
    def sync_invoices(cls, user, max_results: int = 30) -> list:
        """
        Escanea la bandeja de Gmail del usuario buscando facturas / recibos / adjuntos PDF e imágenes.
        Descarga los ficheros, crea las entidades Document y ejecuta el matching inteligente.
        """
        try:
            gmail_account = GmailAccount.objects.get(user=user, is_active=True)
        except GmailAccount.DoesNotExist:
            raise ValueError("El usuario no tiene una cuenta de Gmail vinculada y activa.")

        access_token = cls.get_valid_access_token(gmail_account)
        headers = {'Authorization': f"Bearer {access_token}"}

        # 1. Buscar mensajes que coincidan con la query
        query = gmail_account.sync_query or 'has:attachment (filename:pdf OR filename:png OR filename:jpg OR filename:jpeg)'
        list_url = f"{GMAIL_API_BASE}/messages"
        params = {'q': query, 'maxResults': max_results}

        response = requests.get(list_url, headers=headers, params=params, timeout=15)
        if not response.ok:
            logger.error(f"Error listando mensajes de Gmail: {response.text}")
            raise RuntimeError(f"Error al listar mensajes de Gmail: {response.text}")

        messages = response.json().get('messages', [])
        synced_documents = []
        storage = get_storage_manager()

        for msg_summary in messages:
            msg_id = msg_summary['id']
            # Obtener detalle del mensaje
            detail_url = f"{GMAIL_API_BASE}/messages/{msg_id}?format=full"
            msg_res = requests.get(detail_url, headers=headers, timeout=15)
            if not msg_res.ok:
                continue

            msg_data = msg_res.json()
            payload = msg_data.get('payload', {})
            thread_id = msg_data.get('threadId', '')
            internal_date_ms = int(msg_data.get('internalDate', 0))
            email_date = datetime.fromtimestamp(internal_date_ms / 1000.0, tz=timezone.utc) if internal_date_ms else None

            # Extraer headers
            headers_list = payload.get('headers', [])
            subject = ""
            sender = ""
            for h in headers_list:
                name = h.get('name', '').lower()
                if name == 'subject':
                    subject = h.get('value', '')
                elif name == 'from':
                    sender = h.get('value', '')

            # Extraer importe sugerido del asunto o texto si existe (ej. 45,99€ o 45.99 EUR)
            amount_hint = cls._extract_amount_hint(subject + " " + msg_data.get('snippet', ''))

            # Deep link a Gmail
            web_link = f"https://mail.google.com/mail/u/0/#inbox/{thread_id}" if thread_id else f"https://mail.google.com/mail/u/0/#all/{msg_id}"

            # Extraer partes con adjuntos
            parts = cls._get_attachment_parts(payload)
            for part in parts:
                filename = part.get('filename')
                body = part.get('body', {})
                attachment_id = body.get('attachmentId')
                mime_type = part.get('mimeType', 'application/pdf')

                if not filename or not attachment_id:
                    continue

                # Filtrar solo PDF o imágenes
                if not (filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg')) or 'pdf' in mime_type or 'image' in mime_type):
                    continue

                # Descargar binario del adjunto
                att_url = f"{GMAIL_API_BASE}/messages/{msg_id}/attachments/{attachment_id}"
                att_res = requests.get(att_url, headers=headers, timeout=20)
                if not att_res.ok:
                    continue

                raw_base64 = att_res.json().get('data', '')
                file_bytes = base64.urlsafe_b64decode(raw_base64.encode('UTF-8'))

                # Guardar en Storage
                saved_meta = storage.save_file(user.id, filename, file_bytes, mime_type)
                file_hash = saved_meta['file_hash']

                # Verificar si ya existe este documento exacto por hash para el usuario
                existing_doc = Document.objects.filter(user=user, file_hash=file_hash).first()
                if existing_doc:
                    # Actualizar metadatos si estaban vacíos
                    if not existing_doc.gmail_web_link:
                        existing_doc.gmail_message_id = msg_id
                        existing_doc.gmail_thread_id = thread_id
                        existing_doc.gmail_web_link = web_link
                        existing_doc.email_subject = subject
                        existing_doc.email_sender = sender
                        existing_doc.email_date = email_date
                        existing_doc.save()
                    continue

                # Crear Document
                doc = Document.objects.create(
                    user=user,
                    storage_path=saved_meta['storage_path'],
                    file=saved_meta['storage_path'],
                    file_name=filename,
                    file_size=saved_meta['file_size'],
                    mime_type=mime_type,
                    file_hash=file_hash,
                    gmail_message_id=msg_id,
                    gmail_thread_id=thread_id,
                    gmail_web_link=web_link,
                    email_subject=subject,
                    email_sender=sender,
                    email_date=email_date,
                    amount_hint=amount_hint,
                    status='unmatched'
                )

                # Ejecutar Matching Inteligente
                MatcherService.match_document(doc)
                synced_documents.append(doc)

        # Actualizar timestamp de última sincronización
        gmail_account.last_sync_at = datetime.now(timezone.utc)
        gmail_account.save(update_fields=['last_sync_at', 'updated_at'])

        return synced_documents

    @staticmethod
    def _get_attachment_parts(payload: dict) -> list:
        parts = []
        if 'parts' in payload:
            for subpart in payload['parts']:
                parts.extend(GmailSyncService._get_attachment_parts(subpart))
        else:
            if payload.get('filename') and payload.get('body', {}).get('attachmentId'):
                parts.append(payload)
        return parts

    @staticmethod
    def _extract_amount_hint(text: str):
        """Busca patrones de importes como 123.45€, 123,45 EUR o 1.234,56 €."""
        if not text:
            return None
        # Coincidencia para ej: 12,34€ / 12.34 € / 1.250,50€
        pattern = r'(\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2}))\s*(?:€|EUR|euros?)'
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            raw_num = match.group(1)
            # Normalizar separadores españoles (1.200,50 -> 1200.50)
            if ',' in raw_num and '.' in raw_num:
                raw_num = raw_num.replace('.', '').replace(',', '.')
            elif ',' in raw_num:
                raw_num = raw_num.replace(',', '.')
            try:
                return float(raw_num)
            except ValueError:
                pass
        return None

