from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.deps import get_current_active_user, require_contador
from app.database.session import get_db
from app.models.usuario import Usuario
from app.models.solicitacao import Solicitacao, MensagemSolicitacao
from app.schemas.solicitacao import (
    SolicitacaoCreate,
    SolicitacaoOut,
    SolicitacaoDetailOut,
    SolicitacaoStatusUpdate,
    MensagemSolicitacaoCreate,
    MensagemSolicitacaoOut,
    StatusSolicitacaoEnum,
    DepartamentoEnum,
    PrioridadeEnum,
)

router = APIRouter(prefix="/solicitacoes", tags=["Helpdesk & Solicitações"])


@router.post("", response_model=SolicitacaoOut, status_code=status.HTTP_201_CREATED)
def criar_solicitacao(
    dados: SolicitacaoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
):
    """
    Abre um novo chamado/solicitação no Helpdesk.
    O Tenant Guard injeta automaticamente o tenant_id do usuário logado.
    """
    cliente_id = dados.cliente_id
    if current_user.role == "CLIENTE":
        # Se for cliente logado, força o cliente_id do seu próprio cadastro
        cliente_id = current_user.cliente_id

    nova_solicitacao = Solicitacao(
        tenant_id=current_user.tenant_id,
        cliente_id=cliente_id,
        cliente_nome=dados.cliente_nome,
        assunto=dados.assunto,
        descricao=dados.descricao,
        departamento=dados.departamento.value,
        prioridade=dados.prioridade.value,
        prazo_limite=dados.prazo_limite,
        status=StatusSolicitacaoEnum.ABERTA.value,
        criado_por=current_user.nome,
        origem=dados.origem.value,
        whatsapp_chat_id=dados.whatsapp_chat_id,
    )
    db.add(nova_solicitacao)
    db.commit()
    db.refresh(nova_solicitacao)

    # Cria a primeira mensagem de abertura na linha do tempo
    primeira_msg = MensagemSolicitacao(
        tenant_id=current_user.tenant_id,
        solicitacao_id=nova_solicitacao.id,
        autor_nome=current_user.nome,
        autor_id=current_user.id,
        origem="cliente" if current_user.role == "CLIENTE" else "interno",
        conteudo=dados.descricao,
        tipo_midia="texto",
        is_interna=False,
    )
    db.add(primeira_msg)
    db.commit()

    # Gera imediatamente a proposta técnica via Copiloto IA (RAG)
    try:
        from app.services.ai_copiloto import AiCopilotService
        AiCopilotService.gerar_rascunho_resposta(
            db=db,
            tenant_id=current_user.tenant_id,
            solicitacao=nova_solicitacao,
            pergunta=dados.descricao,
        )
    except Exception as e:
        logger.warning(f"Não foi possível gerar rascunho automático de IA: {e}")

    return nova_solicitacao


@router.get("", response_model=List[SolicitacaoOut])
def listar_solicitacoes(
    status_filtro: Optional[StatusSolicitacaoEnum] = Query(None, alias="status"),
    departamento: Optional[DepartamentoEnum] = None,
    prioridade: Optional[PrioridadeEnum] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
):
    """
    Lista solicitações com isolamento estrito por tenant_id.
    Se for um CLIENTE, lista apenas os chamados da sua própria empresa.
    """
    query = db.query(Solicitacao).filter(Solicitacao.tenant_id == current_user.tenant_id)

    if current_user.role == "CLIENTE":
        query = query.filter(Solicitacao.cliente_id == current_user.cliente_id)

    if status_filtro:
        query = query.filter(Solicitacao.status == status_filtro.value)
    if departamento:
        query = query.filter(Solicitacao.departamento == departamento.value)
    if prioridade:
        query = query.filter(Solicitacao.prioridade == prioridade.value)

    return query.order_by(desc(Solicitacao.created_at)).all()


@router.get("/{solicitacao_id}", response_model=SolicitacaoDetailOut)
def obter_solicitacao(
    solicitacao_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
):
    """
    Retorna o chamado detalhado com sua linha do tempo de mensagens.
    Clientes só visualizam mensagens não-internas (`is_interna == False`).
    """
    query = db.query(Solicitacao).filter(
        Solicitacao.tenant_id == current_user.tenant_id,
        Solicitacao.id == solicitacao_id,
    )
    if current_user.role == "CLIENTE":
        query = query.filter(Solicitacao.cliente_id == current_user.cliente_id)

    solicitacao = query.first()
    if not solicitacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitação não encontrada ou não pertence a este escritório.",
        )

    # Filtra mensagens internas caso seja cliente visualizando
    mensagens_query = db.query(MensagemSolicitacao).filter(
        MensagemSolicitacao.tenant_id == current_user.tenant_id,
        MensagemSolicitacao.solicitacao_id == solicitacao_id,
    )
    if current_user.role == "CLIENTE":
        mensagens_query = mensagens_query.filter(MensagemSolicitacao.is_interna == False)  # noqa: E712

    mensagens = mensagens_query.order_by(MensagemSolicitacao.created_at.asc()).all()

    return SolicitacaoDetailOut(
        id=solicitacao.id,
        tenant_id=solicitacao.tenant_id,
        cliente_id=solicitacao.cliente_id,
        cliente_nome=solicitacao.cliente_nome,
        assunto=solicitacao.assunto,
        descricao=solicitacao.descricao,
        departamento=solicitacao.departamento,
        prioridade=solicitacao.prioridade,
        status=solicitacao.status,
        atribuido_a_id=solicitacao.atribuido_a_id,
        atribuido_a_nome=solicitacao.atribuido_a_nome,
        prazo_limite=solicitacao.prazo_limite,
        resolvido_em=solicitacao.resolvido_em,
        criado_por=solicitacao.criado_por,
        origem=solicitacao.origem,
        whatsapp_chat_id=solicitacao.whatsapp_chat_id,
        created_at=solicitacao.created_at,
        updated_at=solicitacao.updated_at,
        mensagens=mensagens,
        tarefas_count=len(solicitacao.tarefas),
        rascunho_pendente=any(r.status == "pendente_aprovacao" for r in solicitacao.rascunhos_ia),
    )


@router.patch("/{solicitacao_id}/status", response_model=SolicitacaoOut)
def atualizar_status_solicitacao(
    solicitacao_id: str,
    dados: SolicitacaoStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
):
    """Atualiza o status de uma solicitação (Apenas equipe do escritório)."""
    solicitacao = db.query(Solicitacao).filter(
        Solicitacao.tenant_id == current_user.tenant_id,
        Solicitacao.id == solicitacao_id,
    ).first()

    if not solicitacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitação não encontrada.",
        )

    solicitacao.status = dados.status.value
    db.commit()
    db.refresh(solicitacao)
    return solicitacao


@router.post("/{solicitacao_id}/mensagens", response_model=MensagemSolicitacaoOut, status_code=status.HTTP_201_CREATED)
def adicionar_mensagem(
    solicitacao_id: str,
    dados: MensagemSolicitacaoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
):
    """Adiciona uma nova mensagem à linha do tempo da solicitação."""
    solicitacao = db.query(Solicitacao).filter(
        Solicitacao.tenant_id == current_user.tenant_id,
        Solicitacao.id == solicitacao_id,
    ).first()

    if not solicitacao:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitação não encontrada.",
        )

    # Clientes não podem criar notas internas
    is_interna = dados.is_interna if current_user.role != "CLIENTE" else False

    nova_msg = MensagemSolicitacao(
        tenant_id=current_user.tenant_id,
        solicitacao_id=solicitacao_id,
        autor_nome=current_user.nome,
        autor_id=current_user.id,
        origem="cliente" if current_user.role == "CLIENTE" else "interno",
        conteudo=dados.conteudo,
        tipo_midia=dados.tipo_midia.value,
        url_midia=dados.url_midia,
        nome_midia=dados.nome_midia,
        transcricao_audio=dados.transcricao_audio,
        is_interna=is_interna,
    )
    db.add(nova_msg)

    # Se o cliente respondeu, move de volta para em_andamento
    if current_user.role == "CLIENTE" and solicitacao.status == "aguardando_cliente":
        solicitacao.status = "em_andamento"

    db.commit()
    db.refresh(nova_msg)
    return nova_msg
