from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_current_active_user, require_contador
from app.database.session import get_db
from app.models.conhecimento import ArtigoConhecimento
from app.models.usuario import Usuario
from app.schemas.conhecimento import ArtigoConhecimentoCreate, ArtigoConhecimentoUpdate, ArtigoConhecimentoOut

router = APIRouter(prefix="/conhecimento", tags=["Base de Conhecimento & Procedimentos"])


@router.post("", response_model=ArtigoConhecimentoOut, status_code=status.HTTP_201_CREATED)
def create_artigo(
    data: ArtigoConhecimentoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """
    Publica um novo artigo/procedimento na base de conhecimento interna do escritório.
    Artigos alimentam o motor de IA/RAG para responder dúvidas de clientes automaticamente.
    """
    dept = data.departamento.value if hasattr(data.departamento, "value") else (data.departamento or "geral")
    stat = data.status.value if hasattr(data.status, "value") else (data.status or "publicado")

    novo_artigo = ArtigoConhecimento(
        tenant_id=current_user.tenant_id,
        titulo=data.titulo,
        conteudo=data.conteudo,
        departamento=dept,
        tags=data.tags,
        status=stat,
        criado_por=current_user.nome or "Administrador",
        publicado_por=current_user.nome or "Administrador",
    )
    db.add(novo_artigo)
    db.commit()
    db.refresh(novo_artigo)
    return novo_artigo


@router.get("", response_model=List[ArtigoConhecimentoOut])
def list_artigos(
    departamento: Optional[str] = None,
    busca: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Lista artigos da base de conhecimento com isolamento por tenant.
    Suporta busca textual (título e conteúdo) e filtro por departamento.
    """
    query = db.query(ArtigoConhecimento).filter(
        ArtigoConhecimento.tenant_id == current_user.tenant_id
    )

    if departamento and departamento != "all":
        query = query.filter(ArtigoConhecimento.departamento == departamento)

    if busca:
        search_term = f"%{busca}%"
        query = query.filter(
            (ArtigoConhecimento.titulo.ilike(search_term)) |
            (ArtigoConhecimento.conteudo.ilike(search_term))
        )

    return query.order_by(ArtigoConhecimento.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{artigo_id}", response_model=ArtigoConhecimentoOut)
def get_artigo(
    artigo_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """Retorna os detalhes de um artigo específico da base de conhecimento."""
    artigo = db.query(ArtigoConhecimento).filter(
        ArtigoConhecimento.id == artigo_id,
        ArtigoConhecimento.tenant_id == current_user.tenant_id,
    ).first()

    if not artigo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artigo não encontrado na base de conhecimento.",
        )

    return artigo


@router.put("/{artigo_id}", response_model=ArtigoConhecimentoOut)
def update_artigo(
    artigo_id: str,
    data: ArtigoConhecimentoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """Atualiza um artigo existente na base de conhecimento."""
    artigo = db.query(ArtigoConhecimento).filter(
        ArtigoConhecimento.id == artigo_id,
        ArtigoConhecimento.tenant_id == current_user.tenant_id,
    ).first()

    if not artigo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artigo não encontrado na base de conhecimento.",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(artigo, field, value)

    db.commit()
    db.refresh(artigo)
    return artigo


@router.delete("/{artigo_id}")
def delete_artigo(
    artigo_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """Remove um artigo da base de conhecimento."""
    artigo = db.query(ArtigoConhecimento).filter(
        ArtigoConhecimento.id == artigo_id,
        ArtigoConhecimento.tenant_id == current_user.tenant_id,
    ).first()

    if not artigo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artigo não encontrado.",
        )

    db.delete(artigo)
    db.commit()
    return {"status": "success", "mensagem": f"Artigo '{artigo.titulo}' removido com sucesso."}
