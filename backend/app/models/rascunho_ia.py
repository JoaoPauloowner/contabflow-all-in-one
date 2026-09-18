from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.base import TenantModelMixin, TimestampMixin, generate_uuid


class RascunhoIA(Base, TenantModelMixin, TimestampMixin):
    """
    Rascunho de resposta técnica elaborado pelo Copiloto de IA a partir
    da análise da solicitação e consulta RAG na Base de Conhecimento.
    
    Princípio Human-in-the-Loop:
    Nenhum rascunho é enviado diretamente ao cliente sem passar pela
    revisão, possível edição e aprovação expressa do contador responsável.
    """
    __tablename__ = "rascunhos_ia"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    solicitacao_id = Column(String(36), ForeignKey("solicitacoes.id", ondelete="CASCADE"), nullable=False, index=True)

    criado_por = Column(String(255), nullable=False, default="copiloto-ia")
    
    # Status: pendente_aprovacao, editado, aprovado, rejeitado
    status = Column(String(30), nullable=False, default="pendente_aprovacao", index=True)

    # Conteúdo sugerido pela IA e versão com edições humanas
    conteudo_original = Column(Text, nullable=False)
    conteudo_editado = Column(Text, nullable=True)

    # Nível de certeza: baixa, media, alta
    confianca = Column(String(20), nullable=False, default="media")
    
    # Identificador do modelo gerador (ex: gpt-4o, gemini-1.5-pro, claude-3-5-sonnet)
    modelo_llm = Column(String(100), nullable=False, default="gpt-4o")

    # Fontes de conhecimento consultadas durante o RAG (armazenado em formato JSON string)
    fontes_usadas_json = Column(Text, nullable=True)

    # Auditoria de aprovação humana
    aprovado_por_id = Column(String(36), nullable=True)
    aprovado_por_nome = Column(String(255), nullable=True)
    aprovado_em = Column(DateTime(timezone=True), nullable=True)

    # Registro de justificativa em caso de rejeição
    motivo_rejeicao = Column(Text, nullable=True)

    # Flag indicando se a resposta aprovada foi despachada para o WhatsApp do cliente
    despachado_whatsapp = Column(Boolean, nullable=False, default=False)

    # Relacionamento
    solicitacao = relationship("Solicitacao", back_populates="rascunhos_ia")
