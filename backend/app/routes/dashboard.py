from datetime import date, timedelta
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_current_active_user, require_contador
from app.database.session import get_db
from app.models.cliente import Cliente
from app.models.documento import Documento
from app.models.imposto import Imposto
from app.models.usuario import Usuario
from app.models.mensagem_whatsapp import MensagemWhatsApp
from app.models.solicitacao import Solicitacao
from app.models.rascunho_ia import RascunhoIA
from app.models.tarefa import Tarefa
from app.schemas.dashboard import (
    ClientePendenciaSummary,
    DashboardClienteMetrics,
    DashboardClienteResponse,
    DashboardContadorMetrics,
    DashboardContadorResponse,
    MensagemWhatsAppDashboardResponse,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboards & Cockpit"])


@router.get("/contador", response_model=DashboardContadorResponse)
def get_dashboard_contador(
    competencia: str = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_contador),
) -> Any:
    """
    Retorna a visão panorâmica e os indicadores operacionais do escritório de contabilidade.
    Inclui dados consolidados do Helpdesk, IA e Tarefas do All-in-One.
    """
    hoje = date.today()
    limite_5_dias = hoje + timedelta(days=5)

    if not competencia:
        competencia = hoje.strftime("%m/%Y")

    tenant_id = current_user.tenant_id

    # 1. Total de clientes ativos
    clientes = db.query(Cliente).filter(
        Cliente.tenant_id == tenant_id,
        Cliente.ativo == True,  # noqa: E712
    ).all()
    total_clientes = len(clientes)

    # 2. Impostos próximos do vencimento (5 dias)
    impostos_5_dias = db.query(Imposto).filter(
        Imposto.tenant_id == tenant_id,
        Imposto.status == "A_VENCER",
        Imposto.data_vencimento >= hoje,
        Imposto.data_vencimento <= limite_5_dias,
    ).count()

    # 3. Impostos vencidos e não pagos
    impostos_vencidos = db.query(Imposto).filter(
        Imposto.tenant_id == tenant_id,
        Imposto.status.in_(["A_VENCER", "VENCIDO"]),
        Imposto.data_vencimento < hoje,
    ).count()

    # 4. Documentos pendentes de auditoria
    docs_pendentes = db.query(Documento).filter(
        Documento.tenant_id == tenant_id,
        Documento.status == "PENDENTE",
    ).count()

    # 5. Total de documentos recebidos no mês
    total_docs_mes = db.query(Documento).filter(
        Documento.tenant_id == tenant_id,
        Documento.competencia == competencia,
    ).count()

    # 6. Chamados abertos do Helpdesk
    chamados_abertos = db.query(Solicitacao).filter(
        Solicitacao.tenant_id == tenant_id,
        Solicitacao.status.in_(["aberta", "em_analise"]),
    ).count()

    # 7. Rascunhos de IA pendentes de revisão
    rascunhos_pendentes = db.query(RascunhoIA).filter(
        RascunhoIA.tenant_id == tenant_id,
        RascunhoIA.status == "pendente_aprovacao",
    ).count()

    # 8. Tarefas em andamento
    tarefas_andamento = db.query(Tarefa).filter(
        Tarefa.tenant_id == tenant_id,
        Tarefa.status == "em_progresso",
    ).count()

    # 9. Mapeamento de pendências por cliente
    clientes_resumo: List[ClientePendenciaSummary] = []
    clientes_com_pendencia_count = 0

    for cli in clientes:
        docs_enviados = db.query(Documento).filter(
            Documento.tenant_id == tenant_id,
            Documento.cliente_id == cli.id,
            Documento.competencia == competencia,
        ).count()

        impostos_pendentes = db.query(Imposto).filter(
            Imposto.tenant_id == tenant_id,
            Imposto.cliente_id == cli.id,
            Imposto.status.in_(["A_VENCER", "VENCIDO"]),
        ).count()

        possui_pendencia = (docs_enviados == 0) or (impostos_pendentes > 0)
        if docs_enviados == 0:
            clientes_com_pendencia_count += 1

        clientes_resumo.append(
            ClientePendenciaSummary(
                cliente_id=cli.id,
                razao_social=cli.razao_social,
                cnpj_cpf=cli.cnpj_cpf,
                telefone_whatsapp=cli.telefone_whatsapp,
                total_documentos_enviados=docs_enviados,
                total_impostos_pendentes=impostos_pendentes,
                possui_pendencias=possui_pendencia,
            )
        )

    # 10. Documentos recentes e próximos impostos
    ultimos_documentos = db.query(Documento).filter(
        Documento.tenant_id == tenant_id,
    ).order_by(Documento.created_at.desc()).limit(10).all()

    proximos_impostos = db.query(Imposto).filter(
        Imposto.tenant_id == tenant_id,
        Imposto.status == "A_VENCER",
    ).order_by(Imposto.data_vencimento.asc()).limit(10).all()

    metricas = DashboardContadorMetrics(
        total_clientes_ativos=total_clientes,
        clientes_com_pendencia_documental=clientes_com_pendencia_count,
        impostos_a_vencer_5_dias=impostos_5_dias,
        impostos_vencidos_sem_baixa=impostos_vencidos,
        documentos_pendentes_auditoria=docs_pendentes,
        total_documentos_recebidos_mes=total_docs_mes,
        chamados_abertos=chamados_abertos,
        rascunhos_ia_pendentes=rascunhos_pendentes,
        tarefas_em_andamento=tarefas_andamento,
    )

    # 11. Mensagens recebidas no WhatsApp
    mensagens_raw = (
        db.query(MensagemWhatsApp, Cliente.razao_social)
        .outerjoin(Cliente, MensagemWhatsApp.cliente_id == Cliente.id)
        .filter(MensagemWhatsApp.tenant_id == tenant_id)
        .order_by(MensagemWhatsApp.received_at.desc())
        .limit(20)
        .all()
    )

    ultimas_mensagens = [
        MensagemWhatsAppDashboardResponse(
            id=m.id,
            numero_remetente=m.numero_remetente,
            conteudo=m.conteudo or "",
            tipo_midia=m.tipo_midia,
            media_url=m.media_url,
            received_at=m.received_at.strftime("%d/%m/%Y %H:%M") if m.received_at else None,
            cliente_nome=razao or "Cliente WhatsApp",
        )
        for m, razao in mensagens_raw
    ]

    return DashboardContadorResponse(
        metricas=metricas,
        clientes_pendencias=clientes_resumo,
        ultimos_documentos=ultimos_documentos,
        proximos_impostos=proximos_impostos,
        ultimas_mensagens_whatsapp=ultimas_mensagens,
    )


@router.get("/cliente", response_model=DashboardClienteResponse)
def get_dashboard_cliente(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_active_user),
) -> Any:
    """
    Retorna a visão simplificada para o portal da empresa cliente.
    """
    if not current_user.cliente_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário atual não possui empresa cliente associada.",
        )

    hoje = date.today()
    competencia_atual = hoje.strftime("%m/%Y")
    tenant_id = current_user.tenant_id
    cliente_id = current_user.cliente_id

    cliente = db.query(Cliente).filter(
        Cliente.id == cliente_id,
        Cliente.tenant_id == tenant_id,
    ).first()

    if not cliente:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cadastro de empresa não encontrado.",
        )

    # Impostos pendentes
    impostos_pendentes = db.query(Imposto).filter(
        Imposto.tenant_id == tenant_id,
        Imposto.cliente_id == cliente_id,
        Imposto.status.in_(["A_VENCER", "VENCIDO"]),
    ).order_by(Imposto.data_vencimento.asc()).all()

    valor_total_a_vencer = sum(float(imp.valor) for imp in impostos_pendentes if imp.status == "A_VENCER")
    vencidos_count = sum(1 for imp in impostos_pendentes if imp.data_vencimento < hoje)

    # Documentos
    documentos_mes = db.query(Documento).filter(
        Documento.tenant_id == tenant_id,
        Documento.cliente_id == cliente_id,
        Documento.competencia == competencia_atual,
    ).count()

    rejeitados = db.query(Documento).filter(
        Documento.tenant_id == tenant_id,
        Documento.cliente_id == cliente_id,
        Documento.status == "REJEITADO",
    ).count()

    documentos_recentes = db.query(Documento).filter(
        Documento.tenant_id == tenant_id,
        Documento.cliente_id == cliente_id,
    ).order_by(Documento.created_at.desc()).limit(8).all()

    metricas = DashboardClienteMetrics(
        impostos_a_vencer=len(impostos_pendentes) - vencidos_count,
        valor_total_a_vencer=valor_total_a_vencer,
        impostos_vencidos=vencidos_count,
        documentos_enviados_competencia=documentos_mes,
        documentos_rejeitados=rejeitados,
    )

    return DashboardClienteResponse(
        cliente_razao_social=cliente.razao_social,
        cliente_cnpj=cliente.cnpj_cpf,
        competencia_atual=competencia_atual,
        metricas=metricas,
        impostos_pendentes=impostos_pendentes,
        documentos_recentes=documentos_recentes,
    )
