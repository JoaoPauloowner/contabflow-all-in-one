from datetime import datetime, timezone
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

logger = logging.getLogger("contabflow.routes.ia_copiloto")

from app.core.deps import get_current_active_user, require_contador
from app.database.session import get_db
from app.models.usuario import Usuario
from app.models.solicitacao import Solicitacao, MensagemSolicitacao
from app.models.conhecimento import ArtigoConhecimento
from app.models.rascunho_ia import RascunhoIA
from app.models.cliente import Cliente
from app.services.ai_copiloto import AiCopilotService
from app.services.whatsapp import WhatsAppService
from app.schemas.conhecimento import (
    ArtigoConhecimentoCreate,
    ArtigoConhecimentoOut,
    StatusArtigoEnum,
)
from app.schemas.rascunho_ia import (
    RascunhoIAOut,
    RascunhoIAEdit,
    RascunhoIAApprove,
    RascunhoIAReject,
    StatusRascunhoEnum,
)

router = APIRouter(prefix="/ia", tags=["Copiloto IA & Base de Conhecimento"])


# ──────────────────────────────────────────────
# Base de Conhecimento (Artigos & RAG)
# ──────────────────────────────────────────────

@router.get("/artigos", response_model=List[ArtigoConhecimentoOut])
def listar_artigos_conhecimento(
    departamento: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
):
    """
    Busca e lista artigos da base de conhecimento do escritório atual.
    O Tenant Guard assegura que apenas artigos do tenant do usuário são retornados.
    """
    if q:
        return AiCopilotService.buscar_artigos_relevantes(
            db=db,
            tenant_id=current_user.tenant_id,
            consulta=q,
            departamento=departamento,
            limite=10,
        )

    query = db.query(ArtigoConhecimento).filter(
        ArtigoConhecimento.tenant_id == current_user.tenant_id,
        ArtigoConhecimento.status == StatusArtigoEnum.PUBLICADO.value,
    )
    if departamento:
        query = query.filter(ArtigoConhecimento.departamento == departamento)

    return query.order_by(desc(ArtigoConhecimento.created_at)).all()


@router.post("/artigos", response_model=ArtigoConhecimentoOut, status_code=status.HTTP_201_CREATED)
def criar_artigo_conhecimento(
    dados: ArtigoConhecimentoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
):
    """Cadastra um novo artigo técnico na base de conhecimento do escritório."""
    artigo = ArtigoConhecimento(
        tenant_id=current_user.tenant_id,
        titulo=dados.titulo,
        conteudo=dados.conteudo,
        departamento=dados.departamento.value,
        tags=dados.tags,
        status=dados.status.value,
        criado_por=current_user.nome,
        publicado_por=current_user.nome if dados.status == StatusArtigoEnum.PUBLICADO else None,
        publicado_em=datetime.now(timezone.utc) if dados.status == StatusArtigoEnum.PUBLICADO else None,
    )
    db.add(artigo)
    db.commit()
    db.refresh(artigo)
    return artigo


# ──────────────────────────────────────────────
# Rascunhos de Resposta da IA (Human-in-the-Loop)
# ──────────────────────────────────────────────

@router.post("/rascunhos/gerar/{solicitacao_id}", response_model=RascunhoIAOut, status_code=status.HTTP_201_CREATED)
def gerar_rascunho_para_solicitacao(
    solicitacao_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
):
    """
    Aciona o Copiloto de IA para gerar um rascunho de resposta técnica via RAG
    para uma solicitação aberta. O rascunho nasce com status 'pendente_aprovacao'.
    """
    solicitacao = db.query(Solicitacao).filter(
        Solicitacao.tenant_id == current_user.tenant_id,
        Solicitacao.id == solicitacao_id,
    ).first()

    if not solicitacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitação não encontrada.",
        )

    # Busca a última mensagem do cliente
    ultima_msg = (
        db.query(MensagemSolicitacao)
        .filter(
            MensagemSolicitacao.tenant_id == current_user.tenant_id,
            MensagemSolicitacao.solicitacao_id == solicitacao_id,
        )
        .order_by(desc(MensagemSolicitacao.created_at))
        .first()
    )

    pergunta = ultima_msg.conteudo if ultima_msg else solicitacao.descricao

    rascunho = AiCopilotService.gerar_rascunho_resposta(
        db=db,
        tenant_id=current_user.tenant_id,
        solicitacao=solicitacao,
        pergunta=pergunta,
    )
    return rascunho


@router.get("/rascunhos", response_model=List[RascunhoIAOut])
def listar_rascunhos_pendentes(
    status_filtro: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
):
    """Lista a fila de rascunhos de IA aguardando revisão ou histórico."""
    query = db.query(RascunhoIA).filter(RascunhoIA.tenant_id == current_user.tenant_id)
    if status_filtro and status_filtro != "all":
        query = query.filter(RascunhoIA.status == status_filtro)

    return query.order_by(desc(RascunhoIA.created_at)).all()


@router.patch("/rascunhos/{rascunho_id}/editar", response_model=RascunhoIAOut)
def editar_rascunho(
    rascunho_id: str,
    dados: RascunhoIAEdit,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
):
    """Permite ao operador contábil refinar ou corrigir o texto proposto pela IA."""
    rascunho = db.query(RascunhoIA).filter(
        RascunhoIA.tenant_id == current_user.tenant_id,
        RascunhoIA.id == rascunho_id,
    ).first()

    if not rascunho:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rascunho não encontrado.",
        )

    rascunho.conteudo_editado = dados.conteudo_editado
    rascunho.status = StatusRascunhoEnum.EDITADO.value
    db.commit()
    db.refresh(rascunho)
    return rascunho


@router.post("/rascunhos/{rascunho_id}/aprovar", response_model=RascunhoIAOut)
async def aprovar_rascunho(
    rascunho_id: str,
    dados: RascunhoIAApprove,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
):
    """
    Aprova o rascunho de IA (Human-in-the-Loop).
    Adiciona a resposta à linha do tempo da solicitação e, se solicitado,
    dispara a mensagem via WhatsApp Bridge para o cliente.
    """
    rascunho = db.query(RascunhoIA).filter(
        RascunhoIA.tenant_id == current_user.tenant_id,
        RascunhoIA.id == rascunho_id,
    ).first()

    if not rascunho:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rascunho não encontrado.",
        )

    solicitacao = db.query(Solicitacao).filter(
        Solicitacao.tenant_id == current_user.tenant_id,
        Solicitacao.id == rascunho.solicitacao_id,
    ).first()

    texto_final = dados.conteudo_final or rascunho.conteudo_editado or rascunho.conteudo_original

    # Atualiza auditoria de aprovação do rascunho
    rascunho.status = StatusRascunhoEnum.APROVADO.value
    rascunho.aprovado_por_id = current_user.id
    rascunho.aprovado_por_nome = current_user.nome
    rascunho.aprovado_em = datetime.now(timezone.utc)

    # Adiciona resposta aprovada à linha do tempo da solicitação
    msg_aprovada = MensagemSolicitacao(
        tenant_id=current_user.tenant_id,
        solicitacao_id=solicitacao.id,
        autor_nome=f"{current_user.nome} (com auxílio da IA)",
        autor_id=current_user.id,
        origem="ia_aprovada",
        conteudo=texto_final,
        tipo_midia="texto",
        is_interna=False,
    )
    db.add(msg_aprovada)

    # Marca solicitação como respondida / aguardando cliente
    solicitacao.status = "aguardando_cliente"

    # Se foi solicitado despacho via WhatsApp
    if dados.despachar_whatsapp:
        cliente = None
        if solicitacao.cliente_id:
            cliente = db.query(Cliente).filter(
                Cliente.tenant_id == current_user.tenant_id,
                Cliente.id == solicitacao.cliente_id,
            ).first()

        # Fallback 1: Buscar por nome/razão social
        if not cliente and solicitacao.cliente_nome:
            cliente = db.query(Cliente).filter(
                Cliente.tenant_id == current_user.tenant_id,
                (Cliente.razao_social == solicitacao.cliente_nome) | (Cliente.nome_fantasia == solicitacao.cliente_nome),
            ).first()

        # Fallback 2: Se só existe 1 cliente ativo no escritório, associa
        if not cliente:
            clientes_tenant = db.query(Cliente).filter(
                Cliente.tenant_id == current_user.tenant_id,
                Cliente.ativo == True,
            ).all()
            if len(clientes_tenant) == 1:
                cliente = clientes_tenant[0]

        if cliente:
            if not solicitacao.cliente_id:
                solicitacao.cliente_id = cliente.id
            if not solicitacao.whatsapp_chat_id and cliente.telefone_whatsapp:
                solicitacao.whatsapp_chat_id = f"{WhatsAppService.normalizar_telefone(cliente.telefone_whatsapp)}@s.whatsapp.net"

            if cliente.telefone_whatsapp:
                logger.info(f"Disparando resposta da solicitação {solicitacao.id} para {cliente.razao_social} ({cliente.telefone_whatsapp})")
                msg_enviada = await WhatsAppService.enviar_mensagem_texto(
                    db=db,
                    tenant_id=current_user.tenant_id,
                    cliente=cliente,
                    mensagem=texto_final,
                )
                if msg_enviada:
                    rascunho.despachado_whatsapp = True

    db.commit()
    db.refresh(rascunho)
    return rascunho


@router.post("/rascunhos/{rascunho_id}/rejeitar", response_model=RascunhoIAOut)
def rejeitar_rascunho(
    rascunho_id: str,
    dados: RascunhoIAReject,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
):
    """Rejeita a sugestão gerada pela IA, gravando o motivo para aprendizado e auditoria."""
    rascunho = db.query(RascunhoIA).filter(
        RascunhoIA.tenant_id == current_user.tenant_id,
        RascunhoIA.id == rascunho_id,
    ).first()

    if not rascunho:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rascunho não encontrado.",
        )

    rascunho.status = StatusRascunhoEnum.REJEITADO.value
    rascunho.motivo_rejeicao = dados.motivo_rejeicao
    db.commit()
    db.refresh(rascunho)
    return rascunho
