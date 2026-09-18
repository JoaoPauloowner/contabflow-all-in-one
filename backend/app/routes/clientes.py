from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import require_contador, get_current_active_user
from app.core.security import get_password_hash
from app.database.session import get_db
from app.models.cliente import Cliente
from app.models.usuario import Usuario
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate

router = APIRouter(prefix="/clientes", tags=["Gestão de Clientes"])


@router.get("", response_model=List[ClienteResponse])
def list_clientes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """Lista todos os clientes do escritório (Tenant) atual."""
    return (
        db.query(Cliente)
        .filter(Cliente.tenant_id == current_user.tenant_id)
        .order_by(Cliente.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
def create_cliente(
    data: ClienteCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """Cadastra um novo cliente no escritório com isolamento de tenant."""
    existente = (
        db.query(Cliente)
        .filter(
            Cliente.tenant_id == current_user.tenant_id,
            Cliente.cnpj_cpf == data.cnpj_cpf,
        )
        .first()
    )
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Já existe um cliente cadastrado com este CNPJ/CPF neste escritório.",
        )

    novo_cliente = Cliente(
        tenant_id=current_user.tenant_id,
        razao_social=data.razao_social,
        nome_fantasia=data.nome_fantasia,
        cnpj_cpf=data.cnpj_cpf,
        email=data.email,
        telefone_whatsapp=data.telefone_whatsapp,
        regime_tributario=data.regime_tributario or "SIMPLES_NACIONAL",
        ativo=True,
    )
    db.add(novo_cliente)
    db.flush()

    if data.criar_usuario_acesso and data.usuario_senha:
        usuario_email = data.email
        user_exist = db.query(Usuario).filter(Usuario.email == usuario_email).first()
        if not user_exist:
            cliente_user = Usuario(
                tenant_id=current_user.tenant_id,
                cliente_id=novo_cliente.id,
                email=usuario_email,
                nome=data.usuario_nome or data.razao_social,
                hashed_password=get_password_hash(data.usuario_senha),
                role="CLIENTE",
                ativo=True,
            )
            db.add(cliente_user)

    db.commit()
    db.refresh(novo_cliente)
    return novo_cliente


@router.get("/{cliente_id}", response_model=ClienteResponse)
def get_cliente(
    cliente_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """Retorna detalhes de um cliente específico com garantia de isolamento."""
    cliente = (
        db.query(Cliente)
        .filter(
            Cliente.id == cliente_id,
            Cliente.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente não encontrado.",
        )
    return cliente
