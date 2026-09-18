from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class DocumentoAuditRequest(BaseModel):
    status: str = Field(..., pattern="^(VALIDADO|REJEITADO)$")
    motivo_rejeicao: Optional[str] = None


class DocumentoResponse(BaseModel):
    id: str
    tenant_id: str
    cliente_id: str
    titulo: str
    tipo: str
    competencia: str
    file_name: str
    file_path: str
    file_size: int
    file_extension: str
    status: str
    motivo_rejeicao: Optional[str] = None
    enviado_por: Optional[str] = None
    chave_acesso: Optional[str] = None
    valor_total: Optional[float] = None
    cnpj_emitente: Optional[str] = None
    score_confianca: Optional[float] = None
    dados_extraidos_json: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
