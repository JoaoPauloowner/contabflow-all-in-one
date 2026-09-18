from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_current_active_user, require_contador
from app.database.session import get_db
from app.models.tarefa import Tarefa
from app.models.usuario import Usuario
from app.schemas.tarefa import TarefaCreate, TarefaUpdate, TarefaStatusUpdate, TarefaOut

router = APIRouter(prefix="/tarefas", tags=["Gestão de Tarefas Internas"])


@router.post("", response_model=TarefaOut, status_code=status.HTTP_201_CREATED)
def create_tarefa(
    data: TarefaCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """
    Cria uma nova tarefa interna do escritório contábil.
    Pode ser avulsa ou vinculada a uma solicitação existente.
    """
    nova_tarefa = Tarefa(
        tenant_id=current_user.tenant_id,
        titulo=data.titulo,
        descricao=data.descricao,
        departamento=data.departamento or "geral",
        prioridade=data.prioridade or "media",
        status="a_fazer",
        responsavel_id=data.responsavel_id,
        responsavel_nome=data.responsavel_nome,
        data_vencimento=data.data_vencimento,
        solicitacao_id=data.solicitacao_id,
        cliente_id=data.cliente_id,
        cliente_nome=data.cliente_nome,
        criado_por=current_user.nome,
    )
    db.add(nova_tarefa)
    db.commit()
    db.refresh(nova_tarefa)
    return nova_tarefa


@router.get("", response_model=List[TarefaOut])
def list_tarefas(
    status_tarefa: Optional[str] = None,
    prioridade: Optional[str] = None,
    departamento: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Lista tarefas internas do escritório com filtros opcionais.
    Isolamento estrito por tenant_id.
    """
    query = db.query(Tarefa).filter(Tarefa.tenant_id == current_user.tenant_id)

    if status_tarefa:
        query = query.filter(Tarefa.status == status_tarefa)

    if prioridade:
        query = query.filter(Tarefa.prioridade == prioridade)

    if departamento:
        query = query.filter(Tarefa.departamento == departamento)

    return query.order_by(Tarefa.created_at.desc()).offset(skip).limit(limit).all()


@router.patch("/{tarefa_id}", response_model=TarefaOut)
def update_tarefa(
    tarefa_id: str,
    data: TarefaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """
    Atualiza o status e/ou dados de uma tarefa existente.
    Se o novo status for 'concluida', registra automaticamente o timestamp.
    """
    tarefa = db.query(Tarefa).filter(
        Tarefa.id == tarefa_id,
        Tarefa.tenant_id == current_user.tenant_id,
    ).first()

    if not tarefa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarefa não encontrada no seu escritório.",
        )

    update_data = data.model_dump(exclude_unset=True)
    
    if "status" in update_data:
        if update_data["status"] == "concluida":
            tarefa.concluida_em = datetime.now(timezone.utc)
        elif update_data["status"] == "a_fazer":
            tarefa.concluida_em = None

    for field, value in update_data.items():
        setattr(tarefa, field, value)

    db.commit()
    db.refresh(tarefa)
    return tarefa


@router.put("/{tarefa_id}", response_model=TarefaOut)
def update_tarefa_full(
    tarefa_id: str,
    data: TarefaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """
    Atualização completa de uma tarefa (título, descrição, departamento, responsável, etc.).
    """
    tarefa = db.query(Tarefa).filter(
        Tarefa.id == tarefa_id,
        Tarefa.tenant_id == current_user.tenant_id,
    ).first()

    if not tarefa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarefa não encontrada no seu escritório.",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tarefa, field, value)

    db.commit()
    db.refresh(tarefa)
    return tarefa
