from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.solicitacao import DepartamentoEnum


class StatusArtigoEnum(str, Enum):
    RASCUNHO = "rascunho"
    PUBLICADO = "publicado"
    ARQUIVADO = "arquivado"


class ArtigoConhecimentoBase(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=255)
    conteudo: str = Field(..., min_length=10)
    departamento: DepartamentoEnum = DepartamentoEnum.GERAL
    tags: Optional[str] = None
    status: StatusArtigoEnum = StatusArtigoEnum.PUBLICADO


class ArtigoConhecimentoCreate(ArtigoConhecimentoBase):
    pass


class ArtigoConhecimentoUpdate(BaseModel):
    titulo: Optional[str] = None
    conteudo: Optional[str] = None
    departamento: Optional[DepartamentoEnum] = None
    tags: Optional[str] = None
    status: Optional[StatusArtigoEnum] = None


class ArtigoConhecimentoOut(ArtigoConhecimentoBase):
    id: str
    tenant_id: str
    criado_por: str
    publicado_por: Optional[str] = None
    publicado_em: Optional[datetime] = None
    embedding_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
