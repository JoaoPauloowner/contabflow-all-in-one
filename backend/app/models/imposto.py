from sqlalchemy import Column, String, Numeric, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.base import generate_uuid, TimestampMixin, TenantModelMixin


class Imposto(Base, TenantModelMixin, TimestampMixin):
    """
    Guia de imposto ou tributo gerada pelo escritório contábil para pagamento pelo cliente.
    """
    __tablename__ = "impostos"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("escritorios.id", ondelete="CASCADE"), nullable=False, index=True)
    cliente_id = Column(String(36), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, index=True)

    titulo = Column(String(255), nullable=False)  # Ex: DAS Simples Nacional, DARF Previdenciário, FGTS
    tipo_guia = Column(String(50), nullable=False)  # DAS, DARF, GPS, FGTS, ICMS, ISS
    competencia = Column(String(7), nullable=False, index=True)  # MM/AAAA
    data_vencimento = Column(Date, nullable=False, index=True)
    valor = Column(Numeric(12, 2), nullable=False)
    
    linha_digitavel = Column(String(100), nullable=True)
    codigo_pix = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    
    status = Column(String(50), default="A_VENCER", nullable=False)  # A_VENCER, PAGO, VENCIDO
    pago_em = Column(DateTime(timezone=True), nullable=True)
    comprovante_pagamento_path = Column(String(500), nullable=True)

    # Relacionamentos
    escritorio = relationship("Escritorio", back_populates="impostos")
    cliente = relationship("Cliente", back_populates="impostos")
