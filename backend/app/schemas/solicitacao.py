from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class DepartamentoEnum(str, Enum):
    FISCAL = "fiscal"
    CONTABIL = "contabil"
    FOLHA = "folha"
    SOCIETARIO = "societario"
    GERAL = "geral"


class PrioridadeEnum(str, Enum):
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"
    URGENTE = "urgente"


class StatusSolicitacaoEnum(str, Enum):
    ABERTA = "aberta"
    EM_ANDAMENTO = "em_andamento"
    AGUARDANDO_CLIENTE = "aguardando_cliente"
    AGUARDANDO_INTERNO = "aguardando_interno"
    RESOLVIDA = "resolvida"
    ARQUIVADA = "arquivada"


class OrigemSolicitacaoEnum(str, Enum):
    PORTAL = "portal"
    WHATSAPP = "whatsapp"
    EMAIL = "email"
    INTERNO = "interno"


class TipoMidiaEnum(str, Enum):
    TEXTO = "texto"
    AUDIO = "audio"
    IMAGEM = "imagem"
    DOCUMENTO = "documento"


# --- Schemas de Mensagens da Solicitação ---

class MensagemSolicitacaoBase(BaseModel):
    conteudo: str = Field(..., min_length=1)
    tipo_midia: TipoMidiaEnum = TipoMidiaEnum.TEXTO
    url_midia: Optional[str] = None
    nome_midia: Optional[str] = None
    transcricao_audio: Optional[str] = None
    is_interna: bool = False


class MensagemSolicitacaoCreate(MensagemSolicitacaoBase):
    autor_nome: str
    autor_id: Optional[str] = None
    origem: str = "interno"


class MensagemSolicitacaoOut(MensagemSolicitacaoBase):
    id: str
    solicitacao_id: str
    tenant_id: str
    autor_nome: str
    autor_id: Optional[str] = None
    origem: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Schemas de Solicitação ---

class SolicitacaoBase(BaseModel):
    assunto: str = Field(..., min_length=3, max_length=255)
    descricao: str = Field(..., min_length=5)
    departamento: DepartamentoEnum = DepartamentoEnum.GERAL
    prioridade: PrioridadeEnum = PrioridadeEnum.MEDIA
    prazo_limite: Optional[datetime] = None


class SolicitacaoCreate(SolicitacaoBase):
    cliente_id: Optional[str] = None
    cliente_nome: str
    origem: OrigemSolicitacaoEnum = OrigemSolicitacaoEnum.PORTAL
    whatsapp_chat_id: Optional[str] = None


class SolicitacaoUpdate(BaseModel):
    assunto: Optional[str] = None
    descricao: Optional[str] = None
    departamento: Optional[DepartamentoEnum] = None
    prioridade: Optional[PrioridadeEnum] = None
    status: Optional[StatusSolicitacaoEnum] = None
    atribuido_a_id: Optional[str] = None
    atribuido_a_nome: Optional[str] = None
    prazo_limite: Optional[datetime] = None


class SolicitacaoStatusUpdate(BaseModel):
    status: StatusSolicitacaoEnum


class SolicitacaoOut(SolicitacaoBase):
    id: str
    tenant_id: str
    cliente_id: Optional[str] = None
    cliente_nome: str
    status: StatusSolicitacaoEnum
    atribuido_a_id: Optional[str] = None
    atribuido_a_nome: Optional[str] = None
    criado_por: str
    origem: OrigemSolicitacaoEnum
    whatsapp_chat_id: Optional[str] = None
    resolvido_em: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SolicitacaoDetailOut(SolicitacaoOut):
    mensagens: List[MensagemSolicitacaoOut] = []
    tarefas_count: int = 0
    rascunho_pendente: bool = False
