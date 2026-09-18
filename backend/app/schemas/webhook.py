from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class WebhookMessageKey(BaseModel):
    remoteJid: str = Field(..., description="JID do remetente (número@s.whatsapp.net)")
    fromMe: bool = Field(False, description="Se a mensagem foi enviada pelo próprio número conectado")
    id: str = Field(..., description="ID único da mensagem no WhatsApp")


class WebhookMessageContent(BaseModel):
    conversation: Optional[str] = None
    extendedTextMessage: Optional[Dict[str, Any]] = None
    imageMessage: Optional[Dict[str, Any]] = None
    documentMessage: Optional[Dict[str, Any]] = None
    audioMessage: Optional[Dict[str, Any]] = None


class WebhookPayload(BaseModel):
    """Payload raiz recebido do webhook do Baileys ou Evolution API."""
    event: Optional[str] = Field("messages.upsert", description="Tipo do evento")
    instance: Optional[str] = Field("contabflow_instance", description="Instância do WhatsApp")
    data: Optional[Dict[str, Any]] = None
    # Suporte a payload plano direto do Baileys
    from_jid: Optional[str] = Field(None, alias="from")
    body: Optional[str] = None
    mediaType: Optional[str] = None
    mediaUrl: Optional[str] = None
    fileName: Optional[str] = None
    messageId: Optional[str] = None


class WebhookResponse(BaseModel):
    status: str = "ok"
    message: str = "Webhook processado com sucesso"
    cliente_identificado: bool = False
    tenant_id: Optional[str] = None
    acao_executada: Optional[str] = None  # 'documento_fiscal_criado', 'solicitacao_helpdesk_criada', 'mensagem_ignorada'
    recurso_id: Optional[str] = None
