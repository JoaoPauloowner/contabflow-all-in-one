from pathlib import Path
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.deps import get_current_active_user, require_contador
from app.database.session import get_db
from app.models.cliente import Cliente
from app.models.documento import Documento
from app.models.usuario import Usuario
from app.schemas.documento import DocumentoAuditRequest, DocumentoResponse
from app.services.storage import StorageService

router = APIRouter(prefix="/documentos", tags=["Documentos & Uploads"])


@router.post("/upload", response_model=DocumentoResponse, status_code=status.HTTP_201_CREATED)
def upload_documento(
    titulo: str = Form(...),
    tipo: str = Form(...),  # NFE, NFCE, EXTRATO, COMPROVANTE, OUTROS
    competencia: str = Form(...),  # MM/AAAA
    cliente_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Recebe arquivo fiscal/contábil com isolamento rigoroso de tenant.
    - Se for perfil CLIENTE, o upload é automaticamente vinculado à sua empresa.
    - Se for CONTADOR, o cliente_id deve ser informado explicitamente.
    """
    target_cliente_id = None
    if current_user.role == "CLIENTE":
        if not current_user.cliente_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário cliente sem empresa vinculada.",
            )
        target_cliente_id = current_user.cliente_id
    else:
        if not cliente_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O campo 'cliente_id' é obrigatório para uploads feitos pelo escritório.",
            )
        # Valida se o cliente informado pertence ao escritório do contador
        cliente = db.query(Cliente).filter(
            Cliente.id == cliente_id,
            Cliente.tenant_id == current_user.tenant_id,
        ).first()
        if not cliente:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente não encontrado no seu escritório.",
            )
        target_cliente_id = cliente.id

    # Salva o arquivo de forma segura
    file_path, original_name, file_size = StorageService.save_upload(
        file=file,
        tenant_id=current_user.tenant_id,
        cliente_id=target_cliente_id,
    )

    doc = Documento(
        tenant_id=current_user.tenant_id,
        cliente_id=target_cliente_id,
        titulo=titulo,
        tipo=tipo,
        competencia=competencia,
        file_name=original_name,
        file_path=file_path,
        file_size=file_size,
        file_extension=Path(original_name).suffix.lower(),
        status="PENDENTE",
        enviado_por=current_user.nome,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Processamento Inteligente com OCR / Parser Fiscal Automático
    try:
        from app.services.ocr_service import OcrFiscalService
        doc = OcrFiscalService.processar_documento(db, doc)
    except Exception as e:
        pass

    return doc


@router.post("/{documento_id}/extrair-ocr", response_model=DocumentoResponse)
def extrair_ocr_documento(
    documento_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """
    Aciona o motor de extração de OCR / Parser fiscal sob demanda para reprocessamento.
    Apenas contadores autorizados do escritório podem acionar.
    """
    doc = db.query(Documento).filter(
        Documento.id == documento_id,
        Documento.tenant_id == current_user.tenant_id,
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento não encontrado no seu escritório.",
        )

    from app.services.ocr_service import OcrFiscalService
    doc_processado = OcrFiscalService.processar_documento(db, doc)
    return doc_processado


@router.get("", response_model=List[DocumentoResponse])
def list_documentos(
    competencia: Optional[str] = None,
    cliente_id: Optional[str] = None,
    status_doc: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Lista documentos fiscais com garantia estrita de isolamento:
    - Contador visualiza documentos de todos os seus clientes (ou filtra por um).
    - Cliente visualiza estritamente os seus próprios documentos.
    """
    query = db.query(Documento).filter(Documento.tenant_id == current_user.tenant_id)

    if current_user.role == "CLIENTE":
        query = query.filter(Documento.cliente_id == current_user.cliente_id)
    elif cliente_id:
        query = query.filter(Documento.cliente_id == cliente_id)

    if competencia:
        query = query.filter(Documento.competencia == competencia)

    if status_doc:
        query = query.filter(Documento.status == status_doc)

    return query.order_by(Documento.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/{documento_id}/auditar", response_model=DocumentoResponse)
def auditar_documento(
    documento_id: str,
    audit_data: DocumentoAuditRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """
    Audita um documento recebido (Aprovar/Validar ou Rejeitar com motivo).
    Apenas contadores autorizados do escritório podem auditar.
    """
    doc = db.query(Documento).filter(
        Documento.id == documento_id,
        Documento.tenant_id == current_user.tenant_id,
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento não encontrado.",
        )

    doc.status = audit_data.status
    if audit_data.status == "REJEITADO":
        if not audit_data.motivo_rejeicao:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="É obrigatório informar o motivo da rejeição.",
            )
        doc.motivo_rejeicao = audit_data.motivo_rejeicao
    else:
        doc.motivo_rejeicao = None

    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{documento_id}/download")
def download_documento(
    documento_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Download seguro do arquivo físico com verificação de posse do tenant/cliente.
    """
    doc = db.query(Documento).filter(
        Documento.id == documento_id,
        Documento.tenant_id == current_user.tenant_id,
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento não encontrado.",
        )

    if current_user.role == "CLIENTE" and doc.cliente_id != current_user.cliente_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso não autorizado a este arquivo.",
        )

    file_path = Path(doc.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo físico não encontrado no servidor de armazenamento.",
        )

    return FileResponse(
        path=str(file_path),
        filename=doc.file_name,
        media_type="application/octet-stream",
    )


@router.get("/{documento_id}/visualizar")
def visualizar_documento(
    documento_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Exibe o arquivo diretamente no navegador (inline) para o visualizador em 3 colunas.
    """
    doc = db.query(Documento).filter(
        Documento.id == documento_id,
        Documento.tenant_id == current_user.tenant_id,
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento não encontrado.",
        )

    if current_user.role == "CLIENTE" and doc.cliente_id != current_user.cliente_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso não autorizado a este arquivo.",
        )

    file_path = Path(doc.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo físico não encontrado.",
        )

    ext = doc.file_extension.lower()
    content_types = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".xml": "application/xml",
        ".txt": "text/plain; charset=utf-8",
        ".ofx": "text/plain; charset=utf-8",
        ".csv": "text/csv; charset=utf-8",
    }
    media_type = content_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        content_disposition_type="inline",
    )


@router.get("/{documento_id}/conteudo-texto")
def obter_conteudo_texto(
    documento_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Retorna o conteúdo textual bruto (XML, OFX ou TXT) para visualização e auditoria no frontend.
    """
    doc = db.query(Documento).filter(
        Documento.id == documento_id,
        Documento.tenant_id == current_user.tenant_id,
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento não encontrado.",
        )

    if current_user.role == "CLIENTE" and doc.cliente_id != current_user.cliente_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso não autorizado a este arquivo.",
        )

    file_path = Path(doc.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Arquivo físico não encontrado.",
        )

    try:
        conteudo = file_path.read_text(encoding="utf-8", errors="replace")
        return {"id": doc.id, "file_name": doc.file_name, "conteudo": conteudo}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Não foi possível ler o arquivo como texto: {str(e)}",
        )

