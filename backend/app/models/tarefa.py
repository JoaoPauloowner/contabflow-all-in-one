from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.base import TenantModelMixin, TimestampMixin, generate_uuid


class Tarefa(Base, TenantModelMixin, TimestampMixin):
    """
    Entidade de gestão operacional da equipe contábil.
    Pode ser criada de forma avulsa ou a partir de uma solicitação de cliente.
    """
    __tablename__ = "tarefas"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    
    # Vínculo opcional com a solicitação de origem
    solicitacao_id = Column(String(36), ForeignKey("solicitacoes.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Vínculo com a empresa cliente
    cliente_id = Column(String(36), nullable=True, index=True)
    cliente_nome = Column(String(255), nullable=True)

    titulo = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=True)

    # Departamentos: fiscal, contabil, folha, societario, geral
    departamento = Column(String(50), nullable=False, default="geral", index=True)

    # Status: a_fazer, em_progresso, bloqueada, concluida, cancelada
    status = Column(String(30), nullable=False, default="a_fazer", index=True)

    # Prioridade: baixa, media, alta, urgente
    prioridade = Column(String(20), nullable=False, default="media", index=True)

    # Responsável interno
    responsavel_id = Column(String(36), nullable=True, index=True)
    responsavel_nome = Column(String(255), nullable=True)

    # Datas de controle e SLA interno
    data_vencimento = Column(DateTime(timezone=True), nullable=True, index=True)
    concluida_em = Column(DateTime(timezone=True), nullable=True)

    criado_por = Column(String(255), nullable=False)

    # Relacionamento
    solicitacao = relationship("Solicitacao", back_populates="tarefas")
