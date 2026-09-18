from typing import List, Optional
from pydantic import BaseModel
from app.schemas.imposto import ImpostoResponse
from app.schemas.documento import DocumentoResponse


class DashboardContadorMetrics(BaseModel):
    total_clientes_ativos: int
    clientes_com_pendencia_documental: int
    impostos_a_vencer_5_dias: int
    impostos_vencidos_sem_baixa: int
    documentos_pendentes_auditoria: int
    total_documentos_recebidos_mes: int
    chamados_abertos: int = 0
    rascunhos_ia_pendentes: int = 0
    tarefas_em_andamento: int = 0


class ClientePendenciaSummary(BaseModel):
    cliente_id: str
    razao_social: str
    cnpj_cpf: str
    telefone_whatsapp: str
    total_documentos_enviados: int
    total_impostos_pendentes: int
    possui_pendencias: bool


class MensagemWhatsAppDashboardResponse(BaseModel):
    id: str
    numero_remetente: str
    conteudo: Optional[str] = None
    tipo_midia: str
    media_url: Optional[str] = None
    received_at: Optional[str] = None
    cliente_nome: Optional[str] = None


class DashboardContadorResponse(BaseModel):
    metricas: DashboardContadorMetrics
    clientes_pendencias: List[ClientePendenciaSummary]
    ultimos_documentos: List[DocumentoResponse]
    proximos_impostos: List[ImpostoResponse]
    ultimas_mensagens_whatsapp: List[MensagemWhatsAppDashboardResponse] = []


class DashboardClienteMetrics(BaseModel):
    impostos_a_vencer: int
    valor_total_a_vencer: float
    impostos_vencidos: int
    documentos_enviados_competencia: int
    documentos_rejeitados: int


class DashboardClienteResponse(BaseModel):
    cliente_razao_social: str
    cliente_cnpj: str
    competencia_atual: str
    metricas: DashboardClienteMetrics
    impostos_pendentes: List[ImpostoResponse]
    documentos_recentes: List[DocumentoResponse]
