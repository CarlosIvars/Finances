"""
FinanCIAs - Isolated Document Processing Sandbox
Sections 51 & 58 of SECURITY_PLAN.md

Parsers of untrusted documents (PDFs, images) are a major attack surface.
This module executes document extraction inside an isolated subprocess boundary with:
- Strict timeouts (prevents ReDoS, parsing hangs, endless loops)
- Strict memory limits (prevents decompression bombs, OOM crashes)
- Stripped environment (zero secrets, no SECRET_KEY or API tokens leaked to child process)
- Fail-safe error handling (graceful fallback if parser crashes or bombs)
"""

import os
import sys
import json
import logging
import subprocess
import tempfile
from typing import Dict, Any

logger = logging.getLogger('api')

# Default execution constraints
PARSER_TIMEOUT_SECONDS = 10
PARSER_MAX_MEMORY_MB = 128
PARSER_MAX_FILE_SIZE_MB = 15


def _get_isolated_env() -> Dict[str, str]:
    """
    Construye un entorno mínimo despojado de cualquier secreto,
    clave de API, variables de Django o credenciales de base de datos.
    """
    safe_keys = {'PATH', 'LANG', 'LC_ALL', 'PYTHONPATH', 'TMPDIR', 'TEMP'}
    isolated_env = {k: v for k, v in os.environ.items() if k in safe_keys}
    # Asegurar que no hay acceso a claves
    for secret_candidate in ('SECRET_KEY', 'GOOGLE_CLIENT_SECRET', 'BANKING_ENCRYPTION_KEY', 'DATABASE_URL'):
        isolated_env.pop(secret_candidate, None)
    return isolated_env


def _run_parser_script(file_path: str, filename: str) -> Dict[str, Any]:
    """
    Código ejecutado en el subproceso aislado.
    Solo realiza lectura de bytes y extracción básica segura de metadatos/texto.
    """
    import json
    import os
    import re

    result = {
        'status': 'error',
        'text': '',
        'amount_hint': None,
        'metadata': {}
    }

    try:
        file_size = os.path.getsize(file_path)
        result['metadata']['file_size'] = file_size
        result['metadata']['filename'] = filename

        # Extracción básica de texto segura
        extracted_text = []
        with open(file_path, 'rb') as f:
            chunk = f.read(1024 * 1024)  # Leer hasta 1MB para escaneo rápido de texto
            # Búsqueda de strings legibles ASCII
            for match in re.finditer(rb'[A-Za-z0-9 \.,\:\-\_\$\/\n]{4,}', chunk):
                try:
                    decoded = match.group(0).decode('utf-8', errors='ignore')
                    extracted_text.append(decoded)
                except Exception:
                    continue

        full_text = " ".join(extracted_text)
        result['text'] = full_text[:4000]  # Limitar tamaño de salida

        # Detección de posibles importes monetarios
        amount_match = re.search(r'(\d+[\.,]\d{2})\s*(?:€|EUR|euros)?', full_text)
        if amount_match:
            val_str = amount_match.group(1).replace(',', '.')
            try:
                result['amount_hint'] = float(val_str)
            except ValueError:
                pass

        result['status'] = 'success'
    except Exception as e:
        result['error'] = str(e)

    return result


class IsolatedDocumentParser:
    """Ejecutor aislado para procesamiento de documentos no confiables."""

    @classmethod
    def parse_file(cls, file_bytes: bytes, filename: str, timeout: int = PARSER_TIMEOUT_SECONDS) -> Dict[str, Any]:
        """
        Ejecuta la extracción de texto en un subproceso aislado con límite de tiempo y memoria.
        """
        if not file_bytes:
            return {'status': 'empty', 'text': '', 'amount_hint': None, 'metadata': {}}

        # Escribir archivo en fichero temporal efímero
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        worker_script = f"""
import sys
import json
from documents.isolation import _run_parser_script

# Configurar límites de recursos en Linux si están disponibles
try:
    import resource
    # Límite de memoria virtual (128 MB)
    mem_limit = {PARSER_MAX_MEMORY_MB} * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (mem_limit, mem_limit))
    # Límite de tiempo de CPU (5 segundos)
    resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
except Exception:
    pass

res = _run_parser_script({json.dumps(tmp_path)}, {json.dumps(filename)})
sys.stdout.write(json.dumps(res))
"""

        try:
            # Invocar subproceso usando el intérprete de Python actual
            python_executable = sys.executable
            env = _get_isolated_env()
            env['PYTHONPATH'] = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

            proc = subprocess.run(
                [python_executable, '-c', worker_script],
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env
            )

            if proc.returncode != 0:
                logger.warning(f"Worker de documento terminó con código {proc.returncode}: {proc.stderr[:200]}")
                return {
                    'status': 'error',
                    'error': f"Worker exited with code {proc.returncode}",
                    'text': '',
                    'amount_hint': None,
                    'metadata': {}
                }

            output = proc.stdout.strip()
            if not output:
                return {'status': 'error', 'error': 'No output from worker', 'text': '', 'amount_hint': None, 'metadata': {}}

            return json.loads(output)

        except subprocess.TimeoutExpired:
            logger.error(f"Worker de documento excedió el timeout de {timeout}s procesando {filename}. Terminando.")
            return {
                'status': 'timeout',
                'error': f"Processing timed out after {timeout} seconds (Decompression or CPU limit)",
                'text': '',
                'amount_hint': None,
                'metadata': {}
            }
        except Exception as e:
            logger.error(f"Error inesperado en worker de documento: {str(e)}")
            return {
                'status': 'error',
                'error': str(e),
                'text': '',
                'amount_hint': None,
                'metadata': {}
            }
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
