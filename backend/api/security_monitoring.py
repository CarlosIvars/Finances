"""
FinanCIAs - Advanced Anomaly Detection & Security Monitoring
Section 97 of SECURITY_PLAN.md

Monitors real-time security events, detects anomalous activities,
creates audit log entries and alerts users/admins for:
- Multiple failed logins / brute force attempts
- OAuth tampering (state/nonce mismatches, PKCE failures)
- Unexpected Google account linking attempts
- Mass deletions or abnormal data destruction
- Large uncharacteristic data exports
- Abnormal AI usage spikes
"""

import logging
from typing import Optional, Dict, Any
from django.core.cache import cache
from django.utils import timezone
from django.contrib.auth.models import User

logger = logging.getLogger('django.security')

# Thresholds and time-to-live (in seconds)
LOGIN_FAILURE_THRESHOLD = 5
LOGIN_FAILURE_WINDOW = 300  # 5 minutes

MASS_DELETION_THRESHOLD = 25
MASS_DELETION_WINDOW = 300  # 5 minutes

OAUTH_ANOMALY_THRESHOLD = 3
OAUTH_ANOMALY_WINDOW = 600  # 10 minutes

AI_USAGE_THRESHOLD = 30
AI_USAGE_WINDOW = 60  # 1 minute


class SecurityMonitor:
    """Motor de detección de anomalías y telemetría de seguridad."""

    @classmethod
    def record_failed_login(cls, ip_address: str, username: Optional[str] = None) -> bool:
        """
        Registra un intento de login fallido.
        Dispara alerta si se excede el umbral de intentos por IP o usuario.
        Retorna True si se detectó un ataque de fuerza bruta.
        """
        clean_ip = ip_address or 'unknown_ip'
        cache_key = f"sec_fail_login_ip:{clean_ip}"

        try:
            count = cache.get(cache_key, 0) + 1
            cache.set(cache_key, count, timeout=LOGIN_FAILURE_WINDOW)
        except Exception:
            count = 1

        if count >= LOGIN_FAILURE_THRESHOLD:
            msg = f"ALERTA SEGURIDAD: Ataque de fuerza bruta detectado desde IP {clean_ip} ({count} fallos). Bloqueando temporalmente."
            logger.warning(msg)

            cls._create_audit_entry(
                user=None,
                action='modify',
                resource='security_monitoring',
                ip_address=clean_ip,
                details={
                    'anomaly': 'brute_force_login',
                    'ip': clean_ip,
                    'username_targeted': username,
                    'failed_attempts': count,
                    'threshold': LOGIN_FAILURE_THRESHOLD
                }
            )
            return True

        return False

    @classmethod
    def record_oauth_anomaly(
        cls,
        failure_type: str,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user: Optional[User] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Registra discrepancias en el flujo OAuth (state mismatch, nonce mismatch, PKCE tampering, account link hijack).
        """
        clean_ip = ip_address or 'unknown_ip'
        cache_key = f"sec_oauth_anomaly:{clean_ip}"

        try:
            count = cache.get(cache_key, 0) + 1
            cache.set(cache_key, count, timeout=OAUTH_ANOMALY_WINDOW)
        except Exception:
            count = 1

        log_details = details.copy() if details else {}
        log_details.update({
            'anomaly': failure_type,
            'ip': clean_ip,
            'session_id': session_id[:8] + '...' if session_id else None,
            'incident_count': count
        })

        msg = f"ALERTA SEGURIDAD: Anomalía OAuth '{failure_type}' detectada desde IP {clean_ip}."
        logger.warning(msg)

        cls._create_audit_entry(
            user=user,
            action='modify',
            resource='security_oauth',
            ip_address=clean_ip,
            details=log_details
        )

        if user and user.is_authenticated:
            cls._create_user_alert(
                user=user,
                title="Actividad de acceso sospechosa",
                message=f"Se ha detectado un intento de autorización OAuth sospechoso ({failure_type}) desde la IP {clean_ip}.",
                icon="🚨",
                related_data={'anomaly': failure_type, 'ip': clean_ip}
            )

        return count >= OAUTH_ANOMALY_THRESHOLD

    @classmethod
    def record_deletion_event(cls, user: User, resource_name: str, count: int = 1, ip_address: Optional[str] = None) -> bool:
        """
        Supervisa borrado de datos. Si un usuario elimina gran volumen de registros en poco tiempo,
        dispara una alerta de seguridad por borrado masivo.
        """
        if not user or not user.is_authenticated:
            return False

        cache_key = f"sec_deletion:{user.id}:{resource_name}"
        try:
            total_deleted = cache.get(cache_key, 0) + count
            cache.set(cache_key, total_deleted, timeout=MASS_DELETION_WINDOW)
        except Exception:
            total_deleted = count

        if total_deleted >= MASS_DELETION_THRESHOLD:
            msg = f"ALERTA SEGURIDAD: Borrado masivo detectado para usuario {user.username} ({total_deleted} elementos en {resource_name})."
            logger.warning(msg)

            cls._create_audit_entry(
                user=user,
                action='delete',
                resource=resource_name,
                ip_address=ip_address,
                details={
                    'anomaly': 'mass_deletion',
                    'resource': resource_name,
                    'total_deleted': total_deleted,
                    'threshold': MASS_DELETION_THRESHOLD
                }
            )

            cls._create_user_alert(
                user=user,
                title="Aviso de borrado masivo",
                message=f"Se ha detectado el borrado de {total_deleted} elementos en {resource_name}.",
                icon="⚠️",
                related_data={'resource': resource_name, 'count': total_deleted}
            )
            return True

        return False

    @classmethod
    def record_export_event(cls, user: User, resource_name: str, record_count: int, ip_address: Optional[str] = None) -> bool:
        """
        Supervisa exportaciones masivas de datos financieros o personales.
        """
        is_large = record_count >= 500
        cls._create_audit_entry(
            user=user,
            action='export',
            resource=resource_name,
            ip_address=ip_address,
            details={
                'records_exported': record_count,
                'is_large_export': is_large
            }
        )
        if is_large:
            logger.info(f"Exportación masiva de datos: Usuario {user.username if user else 'anon'} exportó {record_count} registros de {resource_name}.")
        return is_large

    @classmethod
    def record_ai_usage_spike(cls, user: User, ip_address: Optional[str] = None) -> bool:
        """
        Supervisa saturación o abuso de peticiones a la API del LLM.
        """
        if not user or not user.is_authenticated:
            return False

        cache_key = f"sec_ai_usage:{user.id}"
        try:
            count = cache.get(cache_key, 0) + 1
            cache.set(cache_key, count, timeout=AI_USAGE_WINDOW)
        except Exception:
            count = 1

        if count >= AI_USAGE_THRESHOLD:
            logger.warning(f"ALERTA SEGURIDAD: Picos anormales de consumo de IA por el usuario {user.username} ({count} req/min).")
            cls._create_audit_entry(
                user=user,
                action='modify',
                resource='ai_processing',
                ip_address=ip_address,
                details={
                    'anomaly': 'ai_usage_spike',
                    'requests_in_window': count,
                    'threshold': AI_USAGE_THRESHOLD
                }
            )
            return True
        return False

    @staticmethod
    def _create_audit_entry(user, action: str, resource: str, ip_address: Optional[str], details: Dict[str, Any]):
        try:
            from api.models import AuditLog
            AuditLog.objects.create(
                user=user if (user and getattr(user, 'is_authenticated', False)) else None,
                action=action,
                resource=resource,
                ip_address=ip_address,
                details=details
            )
        except Exception as e:
            logger.error(f"Error escribiendo AuditLog en SecurityMonitor: {e}")

    @staticmethod
    def _create_user_alert(user: User, title: str, message: str, icon: str, related_data: Dict[str, Any]):
        try:
            from api.models import Alert
            Alert.objects.create(
                user=user,
                type='anomaly',
                title=title,
                message=message,
                icon=icon,
                related_data=related_data
            )
        except Exception as e:
            logger.error(f"Error creando Alert en SecurityMonitor: {e}")

