import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import webhook_rate_limiter
from app.database.session import get_db, SessionLocal
from app.models.documento import Documento
from app.models.solicitacao import Solicitacao, MensagemSolicitacao
from app.models.cliente import Cliente
from app.models.escritorio import Escritorio
from app.schemas.webhook import WebhookPayload, WebhookResponse
from app.services.whatsapp import WhatsAppService
from app.services.ai_copiloto import AiCopilotService

logger = logging.getLogger("contabflow.webhook.unificado")

router = APIRouter(prefix="/webhooks", tags=["Webhooks WhatsApp & Automações"])


def _processar_ocr_bg(documento_id: str):
    """Executa o OCR e extração fiscal em segundo plano sem travar o webhook."""
    from app.services.ocr_service import OcrFiscalService
    db_bg = SessionLocal()
    try:
        doc = db_bg.query(Documento).filter(Documento.id == documento_id).first()
        if doc:
            OcrFiscalService.processar_documento(db_bg, doc)
            logger.info(f"[Background Task] OCR concluído com sucesso para doc {documento_id}")
    except Exception as e:
        logger.error(f"[Background Task] Erro no OCR para doc {documento_id}: {e}", exc_info=True)
    finally:
        db_bg.close()


def _gerar_rascunho_ia_bg(tenant_id: str, solicitacao_id: str, texto_mensagem: str):
    """Executa a busca RAG e geração de resposta de IA em segundo plano."""
    db_bg = SessionLocal()
    try:
        solic = db_bg.query(Solicitacao).filter(
            Solicitacao.tenant_id == tenant_id,
            Solicitacao.id == solicitacao_id,
        ).first()
        if solic:
            AiCopilotService.gerar_rascunho_resposta(
                db=db_bg,
                tenant_id=tenant_id,
                solicitacao=solic,
                pergunta=texto_mensagem,
            )
            logger.info(f"[Background Task] Rascunho IA gerado para solicitacao {solicitacao_id}")
    except Exception as e:
        logger.error(f"[Background Task] Erro na IA para solicitacao {solicitacao_id}: {e}", exc_info=True)
    finally:
        db_bg.close()


def _validar_webhook_secret(apikey: str = Header(None, alias="apikey")) -> str:
    """Valida o token de segurança do webhook enviado pelo Baileys/Evolution API."""
    if not apikey or apikey != settings.WHATSAPP_WEBHOOK_SECRET:
        logger.warning(f"Tentativa de acesso ao webhook com apikey inválida: {apikey!r}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: chave de webhook inválida.",
        )
    return apikey


def _determinar_departamento(texto: str) -> str:
    """Classifica automaticamente o departamento da dúvida por análise léxica."""
    t = texto.lower()
    if any(k in t for k in ["imposto", "darf", "das", "nota fiscal", "xml", "icms", "iss", "tributo", "simples"]):
        return "fiscal"
    if any(k in t for k in ["salario", "folha", "ferias", "fgts", "funcionario", "admissao", "demissao", "rescisao", "holerite"]):
        return "folha"
    if any(k in t for k in ["contrato", "abertura", "alteracao", "cnpj", "socios", "junta comercial", "distrato"]):
        return "societario"
    if any(k in t for k in ["balanco", "dre", "lancamento", "conciliacao", "livro diario"]):
        return "contabil"
    return "geral"


@router.post("/whatsapp", response_model=WebhookResponse)
async def receber_webhook_whatsapp(
    payload: WebhookPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    apikey: str = Depends(_validar_webhook_secret),
    _rate: None = Depends(webhook_rate_limiter),
) -> WebhookResponse:
    """
    Novo Coração do Ecossistema: Webhook Unificado do WhatsApp.
    
    1. Identifica o cliente e o escritório (tenant_id) pelo telefone (E.164).
    2. Se for arquivo de mídia (PDF/XML): Salva na tabela de documentos fiscais.
    3. Se for mensagem de texto:
       - Abre automaticamente uma nova Solicitacao no Helpdesk.
       - Aciona o Copiloto de IA para gerar o rascunho com status 'pendente_aprovacao'.
    """
    logger.info(f"Webhook recebido: evento={payload.event}, instancia={payload.instance}")

    # 1. Extração dos dados do payload (suporta estrutura Evolution API, Baileys direto ou flat payload)
    dados = payload.data or {}
    key = dados.get("key", {}) if isinstance(dados, dict) else {}

    remetente_raw = (
        payload.from_jid
        or key.get("remoteJid", "")
        or (dados.get("remoteJid", "") if isinstance(dados, dict) else "")
    )
    message_id = payload.messageId or key.get("id") or (dados.get("id") if isinstance(dados, dict) else None)
    media_url = payload.mediaUrl or (dados.get("media_url") or dados.get("file_path") if isinstance(dados, dict) else None)
    file_name = payload.fileName or (dados.get("fileName") if isinstance(dados, dict) else None)
    tipo_midia = payload.mediaType or (dados.get("mediaType") if isinstance(dados, dict) else "TEXTO") or "TEXTO"
    texto_mensagem = payload.body or (dados.get("text") or dados.get("body") if isinstance(dados, dict) else "") or ""

    # Se ainda não extraiu o texto ou a mídia, vasculha o objeto message interno do Baileys
    if isinstance(dados, dict) and "message" in dados:
        msg_content = dados.get("message") or {}
        if isinstance(msg_content, dict):
            if not texto_mensagem:
                if "conversation" in msg_content and msg_content["conversation"]:
                    texto_mensagem = msg_content["conversation"]
                elif "extendedTextMessage" in msg_content and isinstance(msg_content["extendedTextMessage"], dict):
                    texto_mensagem = msg_content["extendedTextMessage"].get("text", "")
                elif "documentMessage" in msg_content and isinstance(msg_content["documentMessage"], dict):
                    texto_mensagem = msg_content["documentMessage"].get("caption", "")
                elif "imageMessage" in msg_content and isinstance(msg_content["imageMessage"], dict):
                    texto_mensagem = msg_content["imageMessage"].get("caption", "")
                elif "buttonsResponseMessage" in msg_content and isinstance(msg_content["buttonsResponseMessage"], dict):
                    texto_mensagem = msg_content["buttonsResponseMessage"].get("selectedDisplayText") or msg_content["buttonsResponseMessage"].get("selectedButtonId", "")

            if "documentMessage" in msg_content and isinstance(msg_content["documentMessage"], dict):
                doc = msg_content["documentMessage"]
                file_name = file_name or doc.get("fileName", "documento.pdf")
                tipo_midia = "DOCUMENTO"
                media_url = media_url or doc.get("url")
            elif "imageMessage" in msg_content and isinstance(msg_content["imageMessage"], dict):
                file_name = file_name or "imagem.png"
                tipo_midia = "IMAGEM"
                img = msg_content["imageMessage"]
                media_url = media_url or img.get("url")
            elif "audioMessage" in msg_content:
                tipo_midia = "AUDIO"

    if not remetente_raw:
        return WebhookResponse(message="Payload sem remetente identificado")

    # 1.1 Filtragem rígida de eventos de sistema, grupos e broadcasts
    if "@broadcast" in remetente_raw or "@g.us" in remetente_raw:
        logger.info(f"Ignorando evento de broadcast ou grupo: {remetente_raw}")
        return WebhookResponse(message="Evento de broadcast ou grupo ignorado")

    if key.get("fromMe") or (isinstance(dados, dict) and dados.get("fromMe")):
        logger.info("Ignorando mensagem enviada pelo próprio escritório (fromMe)")
        return WebhookResponse(message="Mensagem do próprio aparelho ignorada")

    # Ignora eventos sem conteúdo de mensagem real
    if not (texto_mensagem and texto_mensagem.strip()) and not media_url:
        logger.info("Evento sem texto ou arquivo de mídia (digitação, recibo, etc). Ignorado.")
        return WebhookResponse(message="Evento sem mensagem ignorado")

    tel_limpo = WhatsAppService.normalizar_telefone(remetente_raw)
    # LIDs do WhatsApp possuem 15+ dígitos e não são números E.164 de telefonia
    if not tel_limpo or len(tel_limpo) < 10 or len(tel_limpo) > 14:
        logger.info(f"Identificador não é um telefone de cliente válido (LID/Sistema): {remetente_raw}")
        return WebhookResponse(message="Identificador ignorado (não é telefone válido)")

    logger.info(f"Dados extraídos: remetente={remetente_raw}, tel={tel_limpo}, tipo={tipo_midia}, texto='{texto_mensagem}', arquivo='{file_name}'")

    # 2. Resolução do Cliente e Tenant via WhatsAppService
    resultado = WhatsAppService.resolver_cliente_por_telefone(db, tel_limpo)
    if not resultado:
        logger.info(f"Telefone {tel_limpo} não cadastrado. Criando contato automático para não perder mensagem.")
        escritorio = db.query(Escritorio).first()
        if not escritorio:
            logger.warning(f"Telefone {tel_limpo} não pertence a nenhum cliente e não há escritório cadastrado.")
            return WebhookResponse(
                message="Mensagem recebida de número desconhecido e sem escritório cadastrado",
                cliente_identificado=False,
            )
        sufixo = tel_limpo[-8:]
        novo_cliente = Cliente(
            tenant_id=escritorio.id,
            razao_social=f"WhatsApp ({sufixo})",
            nome_fantasia=f"Cliente WhatsApp {sufixo}",
            cnpj_cpf="000.000.000-00",
            email=f"whatsapp_{sufixo}@contabflow.local",
            telefone_whatsapp=tel_limpo,
            regime_tributario="SIMPLES_NACIONAL",
            ativo=True,
        )
        db.add(novo_cliente)
        db.commit()
        db.refresh(novo_cliente)
        tenant_id, cliente_id, cliente = (escritorio.id, novo_cliente.id, novo_cliente)
    else:
        tenant_id, cliente_id, cliente = resultado


    # 3. Registra histórico da mensagem recebida
    WhatsAppService.registrar_mensagem(
        db=db,
        tenant_id=tenant_id,
        cliente_id=cliente_id,
        direcao="ENTRADA",
        numero_remetente=remetente_raw,
        numero_destinatario="SISTEMA",
        conteudo=texto_mensagem or f"[Arquivo {tipo_midia}: {file_name}]",
        tipo_midia=tipo_midia,
        media_url=media_url,
        message_id_externo=message_id,
    )

    agora = datetime.now(timezone.utc)
    competencia_atual = agora.strftime("%m/%Y")

    # ─────────────────────────────────────────────────────────────
    # RAMIFICAÇÃO A: Arquivo de Mídia (PDF / XML / Comprovante)
    # ─────────────────────────────────────────────────────────────
    if tipo_midia in ("DOCUMENTO", "IMAGEM") or (file_name and any(ext in file_name.lower() for ext in [".xml", ".pdf", ".png", ".jpg"])):
        extensao = f".{file_name.split('.')[-1].lower()}" if file_name and "." in file_name else ".pdf"
        tipo_doc = "NFE" if ".xml" in extensao else "COMPROVANTE" if tipo_midia == "IMAGEM" else "EXTRATO"

        novo_documento = Documento(
            tenant_id=tenant_id,
            cliente_id=cliente_id,
            titulo=f"Doc WhatsApp: {file_name or 'Arquivo Fiscal'}",
            tipo=tipo_doc,
            competencia=competencia_atual,
            file_name=file_name or f"whatsapp_upload_{agora.strftime('%Y%m%d%H%M%S')}{extensao}",
            file_path=media_url or "uploads/whatsapp/pendente",
            file_size=1024,
            file_extension=extensao,
            status="PENDENTE",
            enviado_por=f"{cliente.razao_social} (via WhatsApp)",
        )
        db.add(novo_documento)
        db.commit()
        db.refresh(novo_documento)

        # Agenda o processamento de OCR / Parser Fiscal em segundo plano (não trava o webhook)
        background_tasks.add_task(_processar_ocr_bg, novo_documento.id)
        logger.info(f"Documento fiscal {novo_documento.id} enfileirado para OCR em background.")

        # Resposta automática amigável de confirmação
        await WhatsAppService.enviar_mensagem_texto(
            db=db,
            tenant_id=tenant_id,
            cliente=cliente,
            mensagem=f"✅ Olá, {cliente.razao_social}! Recebemos seu documento '{novo_documento.file_name}'. Ele já foi encaminhado para a auditoria contábil.",
        )

        return WebhookResponse(
            message="Documento fiscal recebido e catalogado com sucesso",
            cliente_identificado=True,
            tenant_id=tenant_id,
            acao_executada="documento_fiscal_criado",
            recurso_id=novo_documento.id,
        )

    # ─────────────────────────────────────────────────────────────
    # RAMIFICAÇÃO B: Mensagem de Texto com Dúvida / Solicitação
    # ─────────────────────────────────────────────────────────────
    if texto_mensagem:
        departamento = _determinar_departamento(texto_mensagem)
        assunto_resumido = texto_mensagem[:60] + ("..." if len(texto_mensagem) > 60 else "")

        # 1. Cria a Solicitação no Helpdesk
        nova_solicitacao = Solicitacao(
            tenant_id=tenant_id,
            cliente_id=cliente_id,
            cliente_nome=cliente.razao_social,
            assunto=assunto_resumido,
            descricao=texto_mensagem,
            departamento=departamento,
            prioridade="media",
            status="aberta",
            criado_por=f"{cliente.razao_social} (via WhatsApp)",
            origem="whatsapp",
            whatsapp_chat_id=remetente_raw,
        )
        db.add(nova_solicitacao)
        db.commit()
        db.refresh(nova_solicitacao)

        # 2. Adiciona a mensagem na linha do tempo
        primeira_msg = MensagemSolicitacao(
            tenant_id=tenant_id,
            solicitacao_id=nova_solicitacao.id,
            autor_nome=cliente.razao_social,
            autor_id=None,
            origem="whatsapp",
            conteudo=texto_mensagem,
            tipo_midia="texto",
            is_interna=False,
        )
        db.add(primeira_msg)
        db.commit()

        # 3. Agenda o Copiloto de IA para gerar o rascunho de resposta em segundo plano (Human-in-the-Loop)
        background_tasks.add_task(
            _gerar_rascunho_ia_bg,
            tenant_id,
            nova_solicitacao.id,
            texto_mensagem,
        )
        logger.info(
            f"Solicitacao {nova_solicitacao.id} aberta via WhatsApp. "
            f"Geração de rascunho de IA agendada em segundo plano."
        )

        # 4. Envia recibo automático para o cliente no WhatsApp
        await WhatsAppService.enviar_mensagem_texto(
            db=db,
            tenant_id=tenant_id,
            cliente=cliente,
            mensagem=f"📋 Olá! Sua solicitação foi registrada no departamento {departamento.upper()}. Nossa equipe está revisando e retornaremos em breve.",
        )

        return WebhookResponse(
            message="Solicitação aberta no Helpdesk e rascunho de IA gerado para aprovação",
            cliente_identificado=True,
            tenant_id=tenant_id,
            acao_executada="solicitacao_helpdesk_criada",
            recurso_id=nova_solicitacao.id,
        )

    return WebhookResponse(
        message="Evento processado sem ação requerida",
        cliente_identificado=True,
        tenant_id=tenant_id,
        acao_executada="mensagem_ignorada",
    )
