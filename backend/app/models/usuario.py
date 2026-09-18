from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.base import generate_uuid, TimestampMixin, TenantModelMixin


class Usuario(Base, TenantModelMixin, TimestampMixin):
    """
    Usuário do sistema: pode ser o contador/gestor (ADMIN_ESCRITORIO, OPERADOR_ESCRITORIO)
    ou o próprio cliente final do escritório (CLIENTE).
    """
    __tablename__ = "usuarios"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("escritorios.id", ondelete="CASCADE"), nullable=False, index=True)
    cliente_id = Column(String(36), ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True, index=True)
    
    email = Column(String(255), nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    nome = Column(String(255), nullable=False)
    role = Column(String(50), default="OPERADOR_ESCRITORIO", nullable=False)  # ADMIN_ESCRITORIO, OPERADOR_ESCRITORIO, CLIENTE
    ativo = Column(Boolean, default=True, nullable=False)

    # Relacionamentos
    escritorio = relationship("Escritorio", back_populates="usuarios")
    cliente = relationship("Cliente", back_populates="usuarios")
