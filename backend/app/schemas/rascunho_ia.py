from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class StatusRascunhoEnum(str, Enum):
    PENDENTE_APROVACAO = "pendente_aprovacao"
    EDITADO = "editado"
    APROVADO = "aprovado"
    REJEITADO = "rejeitado"


class NivelConfiancaEnum(str, Enum):
    BAIXA = "baixa"
    MEDIA = "media"
    ALTA = "alta"


class RascunhoIABase(BaseModel):
    solicitacao_id: str
    conteudo_original: str = Field(..., min_length=5)
    confianca: NivelConfiancaEnum = NivelConfiancaEnum.MEDIA
    modelo_llm: str = "gpt-4o"
    fontes_usadas_json: Optional[str] = None


class RascunhoIACreate(RascunhoIABase):
    criado_por: str = "copiloto-ia"


class RascunhoIAEdit(BaseModel):
    conteudo_editado: str = Field(..., min_length=5)


class RascunhoIAApprove(BaseModel):
    despachar_whatsapp: bool = True
    conteudo_final: Optional[str] = None


class RascunhoIAReject(BaseModel):
    motivo_rejeicao: str = Field(..., min_length=3)


class RascunhoIAOut(RascunhoIABase):
    id: str
    tenant_id: str
    criado_por: str
    status: StatusRascunhoEnum
    conteudo_editado: Optional[str] = None
    aprovado_por_id: Optional[str] = None
    aprovado_por_nome: Optional[str] = None
    aprovado_em: Optional[datetime] = None
    motivo_rejeicao: Optional[str] = None
    despachado_whatsapp: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
