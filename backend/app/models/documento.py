from sqlalchemy import Column, String, Integer, Float, Numeric, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.base import generate_uuid, TimestampMixin, TenantModelMixin


class Documento(Base, TenantModelMixin, TimestampMixin):
    """
    Documento fiscal ou financeiro enviado pelo cliente para o escritório contábil.
    """
    __tablename__ = "documentos"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("escritorios.id", ondelete="CASCADE"), nullable=False, index=True)
    cliente_id = Column(String(36), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, index=True)

    titulo = Column(String(255), nullable=False)
    tipo = Column(String(50), nullable=False)  # NFE, NFCE, EXTRATO, COMPROVANTE, OUTROS
    competencia = Column(String(7), nullable=False, index=True)  # MM/AAAA
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # em bytes
    file_extension = Column(String(10), nullable=False)  # .pdf, .xml, .png, etc.
    
    status = Column(String(50), default="PENDENTE", nullable=False)  # PENDENTE, VALIDADO, REJEITADO
    motivo_rejeicao = Column(Text, nullable=True)
    enviado_por = Column(String(255), nullable=True)

    # Campos de Inteligência Fiscal & OCR Automático
    chave_acesso = Column(String(44), nullable=True, index=True)
    valor_total = Column(Numeric(12, 2), nullable=True)
    cnpj_emitente = Column(String(20), nullable=True)
    score_confianca = Column(Float, nullable=True)
    dados_extraidos_json = Column(Text, nullable=True)

    # Relacionamentos
    escritorio = relationship("Escritorio", back_populates="documentos")
    cliente = relationship("Cliente", back_populates="documentos")
