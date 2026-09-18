from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from app.database.session import Base
from app.models.base import generate_uuid, TimestampMixin, TenantModelMixin, utc_now


class Notificacao(Base, TenantModelMixin, TimestampMixin):
    """
    Log de alertas automáticos disparados para o cliente (e-mail ou WhatsApp).
    Utilizado pela Régua de Cobrança Diária (D-5, D-0, D+1) e cobranças documentais.
    """
    __tablename__ = "notificacoes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("escritorios.id", ondelete="CASCADE"), nullable=False, index=True)
    cliente_id = Column(String(36), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False, index=True)
    imposto_id = Column(String(36), ForeignKey("impostos.id", ondelete="SET NULL"), nullable=True)

    canal = Column(String(50), nullable=False)  # EMAIL, WHATSAPP
    destinatario = Column(String(255), nullable=False)
    assunto = Column(String(255), nullable=True)
    mensagem = Column(Text, nullable=False)
    status_envio = Column(String(50), default="ENVIADO", nullable=False)  # ENVIADO, FALHA, PENDENTE
    sent_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
