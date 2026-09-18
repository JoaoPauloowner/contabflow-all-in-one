from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.base import generate_uuid, TimestampMixin, TenantModelMixin


class Cliente(Base, TenantModelMixin, TimestampMixin):
    """
    Empresa cliente atendida pelo escritório de contabilidade.
    """
    __tablename__ = "clientes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("escritorios.id", ondelete="CASCADE"), nullable=False, index=True)
    
    razao_social = Column(String(255), nullable=False)
    nome_fantasia = Column(String(255), nullable=True)
    cnpj_cpf = Column(String(20), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    telefone_whatsapp = Column(String(50), nullable=False)
    regime_tributario = Column(String(50), default="SIMPLES_NACIONAL", nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)

    # Relacionamentos
    escritorio = relationship("Escritorio", back_populates="clientes")
    usuarios = relationship("Usuario", back_populates="cliente", cascade="all, delete-orphan")
    documentos = relationship("Documento", back_populates="cliente", cascade="all, delete-orphan")
    impostos = relationship("Imposto", back_populates="cliente", cascade="all, delete-orphan")
