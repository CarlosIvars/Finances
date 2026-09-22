import os
import hashlib
from abc import ABC, abstractmethod
from pathlib import Path
from datetime import datetime
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage


class StorageManager(ABC):
    """Interfaz abstracta para el almacenamiento modular de documentos."""

    @abstractmethod
    def save_file(self, user_id: int, file_name: str, content: bytes, mime_type: str = 'application/pdf') -> dict:
        """
        Guarda el fichero y retorna metadatos:
        {
            'storage_path': str,
            'file_name': str,
            'file_size': int,
            'file_hash': str,
            'url': str
        }
        """
        pass

    @abstractmethod
    def get_url(self, document) -> str:
        """Obtiene la URL pública o firmada para visualizar/descargar el documento."""
        pass

    @abstractmethod
    def delete_file(self, document) -> bool:
        """Elimina el archivo del almacenamiento."""
        pass


class LocalStorageManager(StorageManager):
    """Almacenamiento en disco local utilizando MEDIA_ROOT / documents / ..."""

    def save_file(self, user_id: int, file_name: str, content: bytes, mime_type: str = 'application/pdf') -> dict:
        from api.security_utils import validate_uploaded_file, generate_safe_storage_name
        # Validar magic bytes, extensión y tamaño máximo (Sección 48)
        validate_uploaded_file(content, file_name)

        now = datetime.now()
        clean_name = os.path.basename(file_name)
        safe_name = generate_safe_storage_name(clean_name)
        rel_path = f"documents/{user_id}/{now.year}/{now.month:02d}/{safe_name}"

        file_hash = hashlib.sha256(content).hexdigest()

        # Guardar usando el storage por defecto de Django o filesystem
        saved_path = default_storage.save(rel_path, ContentFile(content))
        url = f"{settings.MEDIA_URL.rstrip('/')}/{saved_path}"

        return {
            'storage_path': saved_path,
            'file_name': clean_name,
            'file_size': len(content),
            'file_hash': file_hash,
            'url': url
        }

    def get_url(self, document) -> str:
        if document.file and hasattr(document.file, 'url'):
            return document.file.url
        if document.storage_path:
            return f"{settings.MEDIA_URL.rstrip('/')}/{document.storage_path}"
        return ""

    def delete_file(self, document) -> bool:
        try:
            if document.file:
                document.file.delete(save=False)
            elif document.storage_path and default_storage.exists(document.storage_path):
                default_storage.delete(document.storage_path)
            return True
        except Exception:
            return False


class GCSStorageManager(StorageManager):
    """
    Almacenamiento en Google Cloud Storage (Bucket).
    Listo para producción activando STORAGE_BACKEND=gcs en .env
    """

    def __init__(self):
        self.bucket_name = os.environ.get('GCS_BUCKET_NAME', 'financias-documents')
        self.project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', '')

    def _get_client(self):
        try:
            from google.cloud import storage
            return storage.Client(project=self.project_id or None)
        except ImportError:
            raise RuntimeError("google-cloud-storage no está instalado en el entorno.")

    def save_file(self, user_id: int, file_name: str, content: bytes, mime_type: str = 'application/pdf') -> dict:
        from api.security_utils import validate_uploaded_file, generate_safe_storage_name
        validate_uploaded_file(content, file_name)

        now = datetime.now()
        clean_name = os.path.basename(file_name)
        safe_name = generate_safe_storage_name(clean_name)
        blob_name = f"documents/{user_id}/{now.year}/{now.month:02d}/{safe_name}"
        file_hash = hashlib.sha256(content).hexdigest()

        try:
            client = self._get_client()
            bucket = client.bucket(self.bucket_name)
            blob = bucket.blob(blob_name)
            blob.upload_from_string(content, content_type=mime_type)
            return {
                'storage_path': f"gs://{self.bucket_name}/{blob_name}",
                'file_name': clean_name,
                'file_size': len(content),
                'file_hash': file_hash,
                'url': blob.public_url
            }
        except Exception:
            # Fallback a almacenamiento local si GCS no está configurado
            return LocalStorageManager().save_file(user_id, file_name, content, mime_type)

    def get_url(self, document) -> str:
        if document.storage_path.startswith('gs://'):
            try:
                client = self._get_client()
                bucket = client.bucket(self.bucket_name)
                blob_name = document.storage_path.replace(f"gs://{self.bucket_name}/", "")
                blob = bucket.blob(blob_name)
                return blob.generate_signed_url(version="v4", expiration=3600, method="GET")
            except Exception:
                pass
        return LocalStorageManager().get_url(document)

    def delete_file(self, document) -> bool:
        if document.storage_path.startswith('gs://'):
            try:
                client = self._get_client()
                bucket = client.bucket(self.bucket_name)
                blob_name = document.storage_path.replace(f"gs://{self.bucket_name}/", "")
                blob = bucket.blob(blob_name)
                blob.delete()
                return True
            except Exception:
                return False
        return LocalStorageManager().delete_file(document)


def get_storage_manager() -> StorageManager:
    """Fábrica para obtener la instancia de almacenamiento según settings.STORAGE_BACKEND."""
    backend_type = getattr(settings, 'STORAGE_BACKEND', os.environ.get('STORAGE_BACKEND', 'local')).lower()
    if backend_type == 'gcs':
        return GCSStorageManager()
    return LocalStorageManager()

