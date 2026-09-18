from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.solicitacao import DepartamentoEnum, PrioridadeEnum


class StatusTarefaEnum(str, Enum):
    A_FAZER = "a_fazer"
    EM_PROGRESSO = "em_progresso"
    BLOQUEADA = "bloqueada"
    CONCLUIDA = "concluida"
    CANCELADA = "cancelada"


class TarefaBase(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=255)
    descricao: Optional[str] = None
    departamento: DepartamentoEnum = DepartamentoEnum.GERAL
    prioridade: PrioridadeEnum = PrioridadeEnum.MEDIA
    status: StatusTarefaEnum = StatusTarefaEnum.A_FAZER
    responsavel_id: Optional[str] = None
    responsavel_nome: Optional[str] = None
    data_vencimento: Optional[datetime] = None


class TarefaCreate(TarefaBase):
    solicitacao_id: Optional[str] = None
    cliente_id: Optional[str] = None
    cliente_nome: Optional[str] = None


class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    departamento: Optional[DepartamentoEnum] = None
    prioridade: Optional[PrioridadeEnum] = None
    status: Optional[StatusTarefaEnum] = None
    responsavel_id: Optional[str] = None
    responsavel_nome: Optional[str] = None
    data_vencimento: Optional[datetime] = None


class TarefaStatusUpdate(BaseModel):
    status: StatusTarefaEnum


class TarefaOut(TarefaBase):
    id: str
    tenant_id: str
    solicitacao_id: Optional[str] = None
    cliente_id: Optional[str] = None
    cliente_nome: Optional[str] = None
    criado_por: str
    concluida_em: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
