from datetime import date, datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_current_active_user, require_contador
from app.database.session import get_db
from app.models.cliente import Cliente
from app.models.imposto import Imposto
from app.models.usuario import Usuario
from app.schemas.imposto import ImpostoCreate, ImpostoPayRequest, ImpostoResponse

router = APIRouter(prefix="/impostos", tags=["Gestão de Impostos & Guias"])


@router.post("", response_model=ImpostoResponse, status_code=status.HTTP_201_CREATED)
def create_imposto(
    data: ImpostoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """
    Publica uma nova guia de imposto (DAS, DARF, FGTS, etc.) para o cliente pagar.
    Apenas contadores autorizados do escritório podem emitir.
    """
    cliente = db.query(Cliente).filter(
        Cliente.id == data.cliente_id,
        Cliente.tenant_id == current_user.tenant_id,
    ).first()

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente informado não pertence ao seu escritório.",
        )

    hoje = date.today()
    status_inicial = "VENCIDO" if data.data_vencimento < hoje else "A_VENCER"

    novo_imposto = Imposto(
        tenant_id=current_user.tenant_id,
        cliente_id=cliente.id,
        titulo=data.titulo,
        tipo_guia=data.tipo_guia,
        competencia=data.competencia,
        data_vencimento=data.data_vencimento,
        valor=data.valor,
        linha_digitavel=data.linha_digitavel,
        codigo_pix=data.codigo_pix,
        status=status_inicial,
    )
    db.add(novo_imposto)
    db.commit()
    db.refresh(novo_imposto)

    # Dispara alerta de imposto disponível para o cliente
    try:
        from app.services.notifications import NotificationService
        dias_restantes = (data.data_vencimento - hoje).days
        if dias_restantes >= 0:
            NotificationService.alertar_imposto_a_vencer(db, novo_imposto, cliente, dias_restantes)
    except Exception:
        pass  # Falha no envio não impede a criação

    return novo_imposto


@router.get("", response_model=List[ImpostoResponse])
def list_impostos(
    competencia: Optional[str] = None,
    cliente_id: Optional[str] = None,
    status_imposto: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Lista impostos com isolamento absoluto por escritório:
    - Contador visualiza guias de todos os clientes atendidos.
    - Cliente visualiza somente suas próprias guias.
    """
    hoje = date.today()
    query = db.query(Imposto).filter(Imposto.tenant_id == current_user.tenant_id)

    if current_user.role == "CLIENTE":
        query = query.filter(Imposto.cliente_id == current_user.cliente_id)
    elif cliente_id:
        query = query.filter(Imposto.cliente_id == cliente_id)

    if competencia:
        query = query.filter(Imposto.competencia == competencia)

    if status_imposto:
        query = query.filter(Imposto.status == status_imposto)

    impostos = query.order_by(Imposto.data_vencimento.asc()).offset(skip).limit(limit).all()

    # Atualiza em memória status para VENCIDO se data ultrapassada e não pago
    for imp in impostos:
        if imp.status == "A_VENCER" and imp.data_vencimento < hoje:
            imp.status = "VENCIDO"

    return impostos


@router.post("/{imposto_id}/pagar", response_model=ImpostoResponse)
def marcar_como_pago(
    imposto_id: str,
    pay_data: ImpostoPayRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Marca uma guia de imposto como PAGA.
    Tanto o cliente quanto o contador podem registrar a baixa.
    """
    query = db.query(Imposto).filter(
        Imposto.id == imposto_id,
        Imposto.tenant_id == current_user.tenant_id,
    )

    if current_user.role == "CLIENTE":
        query = query.filter(Imposto.cliente_id == current_user.cliente_id)

    imposto = query.first()
    if not imposto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guia de imposto não encontrada.",
        )

    imposto.status = "PAGO"
    imposto.pago_em = pay_data.pago_em or datetime.now(timezone.utc)
    db.commit()
    db.refresh(imposto)
    return imposto


@router.post("/disparar-regua")
def disparar_regua_cobranca(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """
    Executa a régua de cobrança e alertas automáticos para todos os impostos
    do escritório que vencem nos próximos 5 dias.
    """
    try:
        from app.services.notifications import NotificationService
        resultado = NotificationService.executar_regua_automatica(db, current_user.tenant_id)
        return {
            "status": "success",
            "mensagem": "Régua de cobrança executada com sucesso.",
            "detalhes": resultado,
        }
    except Exception as e:
        import logging
        logger = logging.getLogger("contabflow.impostos")
        logger.error(f"Erro na régua de cobrança para tenant {current_user.tenant_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha na execução da régua de cobrança: {str(e)}",
        )


@router.get("/scheduler/status")
def get_scheduler_status(
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """Retorna o status do serviço de agendador de cobrança diário."""
    from app.services.scheduler import cron_scheduler
    return {
        "status": "success",
        "scheduler": cron_scheduler.get_status(),
    }


@router.post("/scheduler/executar-agora")
async def executar_scheduler_agora(
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """Força a execução imediata do ciclo de cobrança do CronScheduler."""
    from app.services.scheduler import cron_scheduler
    stats = await cron_scheduler.executar_ciclo()
    return {
        "status": "success",
        "mensagem": "Ciclo do CronScheduler executado manualmente com sucesso.",
        "detalhes": stats,
    }
