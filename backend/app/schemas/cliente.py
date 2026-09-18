from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ClienteBase(BaseModel):
    razao_social: str = Field(..., min_length=2, max_length=255)
    nome_fantasia: Optional[str] = None
    cnpj_cpf: str = Field(..., min_length=11, max_length=20)
    email: str = Field(..., min_length=5, max_length=255)
    telefone_whatsapp: str = Field(..., min_length=8, max_length=50)
    regime_tributario: Optional[str] = "SIMPLES_NACIONAL"
    ativo: bool = True


class ClienteCreate(ClienteBase):
    criar_usuario_acesso: bool = False
    usuario_nome: Optional[str] = None
    usuario_senha: Optional[str] = None


class ClienteUpdate(BaseModel):
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    cnpj_cpf: Optional[str] = None
    email: Optional[str] = None
    telefone_whatsapp: Optional[str] = None
    regime_tributario: Optional[str] = None
    ativo: Optional[bool] = None


class ClienteResponse(ClienteBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
