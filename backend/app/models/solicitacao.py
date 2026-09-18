from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.base import TenantModelMixin, TimestampMixin, generate_uuid, utc_now


class Solicitacao(Base, TenantModelMixin, TimestampMixin):
    """
    Entidade central do módulo de Atendimento / Helpdesk Contábil.
    Representa um chamado de dúvida, suporte ou pedido de serviço,
    originado via Portal do Cliente, WhatsApp ou internamente.
    """
    __tablename__ = "solicitacoes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    cliente_id = Column(String(36), nullable=True, index=True)
    cliente_nome = Column(String(255), nullable=False)
    
    assunto = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=False)
    
    # Departamentos contábeis: fiscal, contabil, folha, societario, geral
    departamento = Column(String(50), nullable=False, default="geral", index=True)
    
    # Prioridades: baixa, media, alta, urgente
    prioridade = Column(String(20), nullable=False, default="media", index=True)
    
    # Status: aberta, em_andamento, aguardando_cliente, aguardando_interno, resolvida, arquivada
    status = Column(String(30), nullable=False, default="aberta", index=True)
    
    # Atribuição interna
    atribuido_a_id = Column(String(36), nullable=True, index=True)
    atribuido_a_nome = Column(String(255), nullable=True)
    
    # Controle de prazos e SLA
    prazo_limite = Column(DateTime(timezone=True), nullable=True)
    resolvido_em = Column(DateTime(timezone=True), nullable=True)
    
    criado_por = Column(String(255), nullable=False)
    
    # Origem da solicitação: portal, whatsapp, email, interno
    origem = Column(String(30), nullable=False, default="portal", index=True)
    whatsapp_chat_id = Column(String(100), nullable=True, index=True)

    # Relacionamentos
    mensagens = relationship(
        "MensagemSolicitacao",
        back_populates="solicitacao",
        cascade="all, delete-orphan",
        order_by="MensagemSolicitacao.created_at.asc()",
    )
    tarefas = relationship(
        "Tarefa",
        back_populates="solicitacao",
        cascade="all, delete-orphan",
    )
    rascunhos_ia = relationship(
        "RascunhoIA",
        back_populates="solicitacao",
        cascade="all, delete-orphan",
    )


class MensagemSolicitacao(Base, TenantModelMixin, TimestampMixin):
    """
    Linha do tempo de mensagens e mídias trocadas em uma solicitação.
    Pode incluir mensagens internas exclusivas da equipe ou trocas com o cliente.
    """
    __tablename__ = "mensagens_solicitacao"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    solicitacao_id = Column(String(36), ForeignKey("solicitacoes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    autor_nome = Column(String(255), nullable=False)
    autor_id = Column(String(36), nullable=True)
    
    # Origem: interno, cliente, ia, whatsapp, sistema
    origem = Column(String(30), nullable=False, default="interno")
    conteudo = Column(Text, nullable=False)
    
    # Mídias: texto, audio, imagem, documento
    tipo_midia = Column(String(20), nullable=False, default="texto")
    url_midia = Column(String(500), nullable=True)
    nome_midia = Column(String(255), nullable=True)
    transcricao_audio = Column(Text, nullable=True)
    
    # Flag para notas internas que o cliente não visualiza
    is_interna = Column(Boolean, nullable=False, default=False)

    # Relacionamento
    solicitacao = relationship("Solicitacao", back_populates="mensagens")
