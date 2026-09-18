from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.deps import get_current_active_user
from app.core.rate_limit import login_rate_limiter
from app.core.security import get_password_hash, verify_password, create_access_token
from app.database.session import get_db
from app.models.escritorio import Escritorio
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, RegisterTenantRequest, Token, UserResponse

router = APIRouter(prefix="/auth", tags=["Autenticação & Multi-tenancy"])


@router.post("/register-tenant", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_tenant(
    data: RegisterTenantRequest,
    db: Session = Depends(get_db),
) -> Any:
    """Cadastra um novo Escritório (Tenant) e cria seu usuário Administrador."""
    if db.query(Escritorio).filter(Escritorio.cnpj == data.cnpj).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um escritório cadastrado com este CNPJ.",
        )
    if db.query(Escritorio).filter(Escritorio.email == data.email_escritorio).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um escritório cadastrado com este e-mail.",
        )

    novo_escritorio = Escritorio(
        nome=data.nome_escritorio,
        cnpj=data.cnpj,
        email=data.email_escritorio,
        telefone=data.telefone,
        plano="ALL_IN_ONE_PRO",
        ativo=True,
    )
    db.add(novo_escritorio)
    db.flush()

    admin_user = Usuario(
        tenant_id=novo_escritorio.id,
        nome=data.admin_nome,
        email=data.admin_email,
        hashed_password=get_password_hash(data.admin_password),
        role="ADMIN_ESCRITORIO",
        ativo=True,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    token = create_access_token(
        subject=admin_user.id,
        role=admin_user.role,
        tenant_id=admin_user.tenant_id,
        cliente_id=admin_user.cliente_id,
    )

    return Token(
        access_token=token,
        token_type="bearer",
        user_id=admin_user.id,
        tenant_id=admin_user.tenant_id,
        cliente_id=admin_user.cliente_id,
        role=admin_user.role,
        nome=admin_user.nome,
        email=admin_user.email,
    )


@router.post("/login", response_model=Token)
def login(
    data: LoginRequest,
    db: Session = Depends(get_db),
    _rate: None = Depends(login_rate_limiter),
) -> Any:
    """Autentica o usuário e retorna o token JWT com claims tenant_id e role."""
    user = db.query(Usuario).filter(Usuario.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo.",
        )

    token = create_access_token(
        subject=user.id,
        role=user.role,
        tenant_id=user.tenant_id,
        cliente_id=user.cliente_id,
    )

    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        tenant_id=user.tenant_id,
        cliente_id=user.cliente_id,
        role=user.role,
        nome=user.nome,
        email=user.email,
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """Retorna dados do perfil do usuário logado via Tenant Guard."""
    return current_user


@router.get("/escritorio")
def get_escritorio_dados(
    current_user: Usuario = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """Retorna os dados cadastrais e métricas da organização (Escritório) do tenant."""
    escritorio = db.query(Escritorio).filter(Escritorio.id == current_user.tenant_id).first()
    if not escritorio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escritório contábil não localizado para este tenant.",
        )

    from app.models.cliente import Cliente
    total_clientes = db.query(Cliente).filter(Cliente.tenant_id == current_user.tenant_id).count()
    total_usuarios = db.query(Usuario).filter(Usuario.tenant_id == current_user.tenant_id).count()

    return {
        "tenant_id": escritorio.id,
        "nome": escritorio.nome,
        "cnpj": escritorio.cnpj,
        "email": escritorio.email,
        "telefone": escritorio.telefone,
        "plano": escritorio.plano,
        "ativo": escritorio.ativo,
        "created_at": escritorio.created_at,
        "total_clientes": total_clientes,
        "total_usuarios": total_usuarios,
    }

