from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    tenant_id: str
    cliente_id: Optional[str] = None
    role: str
    nome: str
    email: str


class TokenData(BaseModel):
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    role: Optional[str] = None
    cliente_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterTenantRequest(BaseModel):
    nome_escritorio: str = Field(..., min_length=3, max_length=255)
    cnpj: str = Field(..., min_length=14, max_length=20)
    email_escritorio: EmailStr
    telefone: Optional[str] = None
    
    admin_nome: str = Field(..., min_length=3, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=6, max_length=100)


class UserResponse(BaseModel):
    id: str
    email: str
    nome: str
    role: str
    tenant_id: str
    cliente_id: Optional[str] = None
    ativo: bool

    class Config:
        from_attributes = True
