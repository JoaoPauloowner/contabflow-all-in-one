import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime


def generate_uuid() -> str:
    """Gera um identificador único padrão UUID v4 em string."""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Retorna o timestamp atual em UTC com timezone awareness."""
    return datetime.now(timezone.utc)


class TenantModelMixin:
    """
    Mixin padrão mandatório para todas as tabelas filhas de um escritório (Tenant).
    Garante que toda entidade contenha a coluna 'tenant_id' indexada, base
    do isolamento lógico de segurança multi-tenant.
    """
    tenant_id = Column(String(36), nullable=False, index=True)


class TimestampMixin:
    """Mixin com timestamps padronizados de criação e atualização."""
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
