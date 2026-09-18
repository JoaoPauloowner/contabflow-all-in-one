from sqlalchemy import Column, String, Text, DateTime
from app.database.session import Base
from app.models.base import TenantModelMixin, TimestampMixin, generate_uuid, utc_now


class ArtigoConhecimento(Base, TenantModelMixin, TimestampMixin):
    """
    Base de conhecimento corporativa do escritório de contabilidade.
    Armazena procedimentos operacionais padrão, convenções coletivas,
    regras tributárias municipais/estaduais e FAQs internos.
    Utilizada pelo Copiloto de IA como contexto para geração de respostas RAG.
    """
    __tablename__ = "artigos_conhecimento"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    
    titulo = Column(String(255), nullable=False, index=True)
    conteudo = Column(Text, nullable=False)  # Markdown rico com orientações técnicas
    
    # Departamento temático: fiscal, contabil, folha, societario, geral
    departamento = Column(String(50), nullable=False, default="geral", index=True)
    
    # Tags para facilidade de busca e categorização semântica (ex: "simples-nacional, icms, darf")
    tags = Column(String(255), nullable=True)
    
    # Status: rascunho, publicado, arquivado
    status = Column(String(30), nullable=False, default="publicado", index=True)
    
    criado_por = Column(String(255), nullable=False)
    publicado_por = Column(String(255), nullable=True)
    publicado_em = Column(DateTime(timezone=True), default=utc_now, nullable=True)
    
    # Referência opcional para vetor de embeddings (pgvector / Qdrant / Pinecone)
    embedding_id = Column(String(100), nullable=True, index=True)
