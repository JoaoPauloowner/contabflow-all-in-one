from sqlalchemy import Column, String, Boolean
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.base import generate_uuid, TimestampMixin


class Escritorio(Base, TimestampMixin):
    """
    Entidade Raiz do Tenant. Representa um escritório de contabilidade assinante do SaaS.
    """
    __tablename__ = "escritorios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    nome = Column(String(255), nullable=False)
    cnpj = Column(String(20), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    telefone = Column(String(50), nullable=True)
    plano = Column(String(50), default="ALL_IN_ONE_PRO", nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)

    # Relacionamentos
    usuarios = relationship("Usuario", back_populates="escritorio", cascade="all, delete-orphan")
    clientes = relationship("Cliente", back_populates="escritorio", cascade="all, delete-orphan")
    documentos = relationship("Documento", back_populates="escritorio", cascade="all, delete-orphan")
    impostos = relationship("Imposto", back_populates="escritorio", cascade="all, delete-orphan")
