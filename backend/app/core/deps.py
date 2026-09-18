from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import decode_access_token
from app.database.session import get_db
from app.models.usuario import Usuario

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> Usuario:
    """
    Tenant Guard & Autenticação JWT:
    Decodifica o token JWT e carrega o usuário atual do banco.
    Garante que o tenant_id contido no token corresponda aos registros reais,
    impedindo que um token forjado acesse dados de outro escritório.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais de autenticação inválidas ou expiradas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id: Optional[str] = payload.get("sub")
    tenant_id: Optional[str] = payload.get("tenant_id")
    
    if not user_id or not tenant_id:
        raise credentials_exception

    # Busca usuário vinculando obrigatoriamente o tenant_id (Tenant Guard)
    user = db.query(Usuario).filter(
        Usuario.id == user_id,
        Usuario.tenant_id == tenant_id,
    ).first()

    if not user:
        raise credentials_exception

    return user


def get_current_active_user(
    current_user: Usuario = Depends(get_current_user),
) -> Usuario:
    """Valida se o usuário autenticado está ativo no sistema."""
    if not current_user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. Contate o suporte ou o administrador do escritório.",
        )
    return current_user


def require_roles(allowed_roles: List[str]):
    """
    Fábrica de dependências para RBAC (Role-Based Access Control).
    Exemplo: Depends(require_roles(["ADMIN_ESCRITORIO", "OPERADOR_ESCRITORIO"]))
    """
    def role_checker(current_user: Usuario = Depends(get_current_active_user)) -> Usuario:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permissão negada. Requer um dos seguintes perfis: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker


# Aliases do Tenant Guard para segurança declarativa
require_contador = require_roles(["ADMIN_ESCRITORIO", "OPERADOR_ESCRITORIO"])
require_admin_escritorio = require_roles(["ADMIN_ESCRITORIO"])
require_cliente = require_roles(["CLIENTE"])
