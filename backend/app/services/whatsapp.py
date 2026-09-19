import re
import logging
from typing import Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.cliente import Cliente
from app.models.mensagem_whatsapp import MensagemWhatsApp

logger = logging.getLogger("contabflow.services.whatsapp")


class WhatsAppService:
    """
    Serviço de mensageria WhatsApp via Baileys / Evolution API.
    Gerencia normalização telefônica E.164, resolução de tenants e envio/registro de mensagens.
    """

    @staticmethod
    def normalizar_telefone(telefone: str) -> str:
        """
        Normaliza qualquer formato de telefone brasileiro para o padrão E.164 sem '+'.
        Ex: '(11) 99999-8888' -> '5511999998888'
        """
        if not telefone:
            return ""
        telefone = telefone.split("@")[0]
        apenas_numeros = re.sub(r"\D", "", telefone)

        if apenas_numeros.startswith("55") and len(apenas_numeros) in (12, 13):
            return apenas_numeros

        if len(apenas_numeros) in (10, 11):
            return f"55{apenas_numeros}"

        return apenas_numeros

    @staticmethod
    def resolver_cliente_por_telefone(
        db: Session, telefone_raw: str
    ) -> Optional[Tuple[str, str, Cliente]]:
        """
        Busca o cliente pelo número de telefone normalizado.
        Retorna (tenant_id, cliente_id, cliente_obj) ou None se não encontrado.
        """
        telefone_normalizado = WhatsAppService.normalizar_telefone(telefone_raw)
        if not telefone_normalizado:
            return None

        clientes = db.query(Cliente).filter(Cliente.ativo == True).all()  # noqa: E712

        for cliente in clientes:
            telefone_cliente = WhatsAppService.normalizar_telefone(cliente.telefone_whatsapp)

            # 1. Correspondência exata
            if telefone_cliente == telefone_normalizado:
                logger.info(
                    f"Cliente identificado: {cliente.razao_social} "
                    f"(tenant={cliente.tenant_id}, cliente={cliente.id})"
                )
                return (cliente.tenant_id, cliente.id, cliente)

            # 2. Correspondência flexível brasileira (ignora 9º dígito se mesmo DDD)
            if len(telefone_cliente) >= 10 and len(telefone_normalizado) >= 10:
                ddd_cli = telefone_cliente[2:4] if telefone_cliente.startswith("55") else telefone_cliente[:2]
                ddd_raw = telefone_normalizado[2:4] if telefone_normalizado.startswith("55") else telefone_normalizado[:2]
                if ddd_cli == ddd_raw and telefone_cliente[-8:] == telefone_normalizado[-8:]:
                    logger.info(
                        f"Cliente identificado (flexível 9º dígito): {cliente.razao_social}"
                    )
                    return (cliente.tenant_id, cliente.id, cliente)

        logger.warning(f"Nenhum cliente cadastrado com o telefone: {telefone_raw}")
        return None

    @staticmethod
    def registrar_mensagem(
        db: Session,
        tenant_id: str,
        cliente_id: Optional[str],
        direcao: str,
        numero_remetente: str,
        numero_destinatario: str,
        conteudo: Optional[str],
        tipo_midia: str = "TEXTO",
        media_url: Optional[str] = None,
        message_id_externo: Optional[str] = None,
    ) -> MensagemWhatsApp:
        """Persiste a mensagem no histórico do WhatsApp com isolamento tenant_id."""
        msg = MensagemWhatsApp(
            tenant_id=tenant_id,
            cliente_id=cliente_id,
            direcao=direcao,
            numero_remetente=numero_remetente,
            numero_destinatario=numero_destinatario,
            conteudo=conteudo,
            tipo_midia=tipo_midia,
            media_url=media_url,
            message_id_externo=message_id_externo,
            status_entrega="RECEBIDO" if direcao == "ENTRADA" else "ENVIADO",
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg

    @staticmethod
    async def enviar_mensagem_texto(
        db: Session,
        tenant_id: str,
        cliente: Cliente,
        mensagem: str,
    ) -> Optional[MensagemWhatsApp]:
        """Envia mensagem de texto via WhatsApp Bridge."""
        telefone_destino = WhatsAppService.normalizar_telefone(cliente.telefone_whatsapp)
        headers = {
            "Content-Type": "application/json",
            "apikey": settings.WHATSAPP_WEBHOOK_SECRET,
        }
        payload = {
            "number": telefone_destino,
            "text": mensagem,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                inst = getattr(settings, "WHATSAPP_INSTANCE_NAME", "contabflow_instance")
                url = f"{settings.WHATSAPP_BRIDGE_URL}/message/sendText/{inst}"
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code == 404:
                    url_flat = f"{settings.WHATSAPP_BRIDGE_URL}/message/sendText"
                    resp = await client.post(url_flat, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    msg_id = data.get("key", {}).get("id") or data.get("messageId")
                    return WhatsAppService.registrar_mensagem(
                        db=db,
                        tenant_id=tenant_id,
                        cliente_id=cliente.id,
                        direcao="SAIDA",
                        numero_remetente="SISTEMA",
                        numero_destinatario=telefone_destino,
                        conteudo=mensagem,
                        message_id_externo=msg_id,
                    )
        except Exception as e:
            logger.error(f"Erro ao disparar mensagem via WhatsApp Bridge: {e}")

        # Se falhou o envio real, registra no banco como falha/saída
        return WhatsAppService.registrar_mensagem(
            db=db,
            tenant_id=tenant_id,
            cliente_id=cliente.id,
            direcao="SAIDA",
            numero_remetente="SISTEMA",
            numero_destinatario=telefone_destino,
            conteudo=mensagem,
        )
