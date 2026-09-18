from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class ImpostoBase(BaseModel):
    cliente_id: str
    titulo: str = Field(..., min_length=2, max_length=255)
    tipo_guia: str = Field(..., min_length=2, max_length=50)  # DAS, DARF, GPS, FGTS, ICMS, etc.
    competencia: str = Field(..., pattern=r"^\d{2}/\d{4}$")  # MM/AAAA
    data_vencimento: date
    valor: Decimal = Field(..., gt=0)
    linha_digitavel: Optional[str] = None
    codigo_pix: Optional[str] = None


class ImpostoCreate(ImpostoBase):
    pass


class ImpostoUpdate(BaseModel):
    titulo: Optional[str] = None
    data_vencimento: Optional[date] = None
    valor: Optional[Decimal] = None
    linha_digitavel: Optional[str] = None
    codigo_pix: Optional[str] = None
    status: Optional[str] = None


class ImpostoPayRequest(BaseModel):
    pago_em: Optional[datetime] = None


class ImpostoResponse(ImpostoBase):
    id: str
    tenant_id: str
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    status: str
    pago_em: Optional[datetime] = None
    comprovante_pagamento_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
