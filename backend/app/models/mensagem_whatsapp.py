from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from app.database.session import Base
from app.models.base import generate_uuid, TimestampMixin, TenantModelMixin, utc_now


class MensagemWhatsApp(Base, TenantModelMixin, TimestampMixin):
    """
    Registro de mensagens WhatsApp trocadas entre o sistema e os clientes via Baileys.
    Cada mensagem é vinculada ao tenant_id para isolamento multi-tenant.
    """
    __tablename__ = "mensagens_whatsapp"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), ForeignKey("escritorios.id", ondelete="CASCADE"), nullable=False, index=True)
    cliente_id = Column(String(36), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=True, index=True)

    # Direção: ENTRADA (cliente → sistema) ou SAIDA (sistema → cliente)
    direcao = Column(String(10), nullable=False)

    numero_remetente = Column(String(50), nullable=False)
    numero_destinatario = Column(String(50), nullable=False)

    conteudo = Column(Text, nullable=True)
    tipo_midia = Column(String(20), default="TEXTO", nullable=False)  # TEXTO, IMAGEM, DOCUMENTO, AUDIO
    media_url = Column(String(500), nullable=True)

    # Rastreamento do provedor
    message_id_externo = Column(String(100), nullable=True, index=True)
    status_entrega = Column(String(30), default="ENVIADO", nullable=False)  # ENVIADO, ENTREGUE, LIDO, FALHA

    received_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
