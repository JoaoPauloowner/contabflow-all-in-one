"""
Script de Simulação e Teste do Motor de IA (RAG) ContabFlow All-in-One.
Simula o recebimento de uma mensagem de WhatsApp de um cliente,
a busca na Base de Conhecimento com isolamento multi-tenant e a geração do rascunho de IA.
"""
import os
import sys

# Suporte a UTF-8 no terminal Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CURRENT_DIR)

# Força banco SQLite local para testes autônomos
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(CURRENT_DIR, 'test_contabflow.db')}"

from app.database.session import Base, engine, SessionLocal
from app.models.escritorio import Escritorio
from app.models.usuario import Usuario
from app.models.cliente import Cliente
from app.models.conhecimento import ArtigoConhecimento
from app.models.solicitacao import Solicitacao, MensagemSolicitacao
from app.models.rascunho_ia import RascunhoIA
from app.services.whatsapp import WhatsAppService
from app.services.ai_copiloto import AiCopilotService


def rodar_teste():
    print("=" * 70)
    print(">>> INICIANDO TESTE DO MOTOR DE IA (RAG) - CONTABFLOW ALL-IN-ONE")
    print("=" * 70)

    # 1. Cria tabelas no banco de dados SQLite local
    print("\n[1/5] Inicializando banco de dados e aplicando tabelas...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 2. Configura Tenant (Escritório Confiança) e Outro Tenant (para teste de isolamento)
        print("[2/5] Configurando Escritorio (Tenant) e Base de Conhecimento...")

        escritorio = db.query(Escritorio).filter(Escritorio.cnpj == "12345678000199").first()
        if not escritorio:
            escritorio = Escritorio(
                nome="Contabilidade Confianca Ltda",
                cnpj="12345678000199",
                email="contato@confianca.com.br",
                telefone="1133334444",
                plano="ALL_IN_ONE_PRO",
                ativo=True,
            )
            db.add(escritorio)
            db.commit()
            db.refresh(escritorio)

        tenant_id = escritorio.id
        print(f"   [OK] Escritorio ativo: '{escritorio.nome}' (tenant_id={tenant_id})")

        # Cria outro tenant para comprovar isolamento estrito
        outro_escritorio = db.query(Escritorio).filter(Escritorio.cnpj == "99888777000100").first()
        if not outro_escritorio:
            outro_escritorio = Escritorio(
                nome="Escritorio Concorrente S/A",
                cnpj="99888777000100",
                email="concorrente@teste.com",
                ativo=True,
            )
            db.add(outro_escritorio)
            db.commit()
            db.refresh(outro_escritorio)

        # 3. Cadastra o Cliente: João (Padaria Estrela do Sul)
        cliente = db.query(Cliente).filter(Cliente.cnpj_cpf == "44555666000188").first()
        if not cliente:
            cliente = Cliente(
                tenant_id=tenant_id,
                razao_social="Padaria Estrela do Sul Ltda",
                nome_fantasia="Padaria Estrela",
                cnpj_cpf="44555666000188",
                email="joao@padariaestrela.com.br",
                telefone_whatsapp="5511999998888",
                regime_tributario="SIMPLES_NACIONAL",
                ativo=True,
            )
            db.add(cliente)
            db.commit()
            db.refresh(cliente)

        print(f"   [OK] Cliente ativo: '{cliente.razao_social}' (WhatsApp: {cliente.telefone_whatsapp})")

        # 4. Popula Base de Conhecimento com artigo sobre retenção de ISS no Tenant correto
        artigo_iss = (
            db.query(ArtigoConhecimento)
            .filter(
                ArtigoConhecimento.tenant_id == tenant_id,
                ArtigoConhecimento.titulo.ilike("%Retencao de ISS%"),
            )
            .first()
        )
        if not artigo_iss:
            artigo_iss = ArtigoConhecimento(
                tenant_id=tenant_id,
                titulo="Emissao de Nota Fiscal de Servico (NFS-e) com Retencao de ISS",
                departamento="fiscal",
                tags="iss, retencao, nfse, servico, prefeitura, simples nacional",
                status="publicado",
                criado_por="Contador Chefe",
                conteudo=(
                    "Para emitir uma NFS-e com Retencao de ISS:\n"
                    "1. Identifique se o tomador do servico e responsavel tributario perante o municipio.\n"
                    "2. No emissor da Prefeitura, selecione a opcao 'ISS Retido na Fonte: SIM'.\n"
                    "3. Informe a aliquota devida (para empresas do Simples Nacional, use o percentual do Anexo III).\n"
                    "4. O valor do ISS retido sera abatido do valor liquido a pagar pelo tomador.\n"
                    "5. O tomador sera o responsavel exclusivo pelo recolhimento da guia de ISSQN Retido."
                ),
            )
            db.add(artigo_iss)

        # Adiciona artigo no OUTRO tenant (não pode vazar)
        artigo_outro_tenant = (
            db.query(ArtigoConhecimento)
            .filter(
                ArtigoConhecimento.tenant_id == outro_escritorio.id,
                ArtigoConhecimento.titulo.ilike("%Outro Escritorio%"),
            )
            .first()
        )
        if not artigo_outro_tenant:
            artigo_outro_tenant = ArtigoConhecimento(
                tenant_id=outro_escritorio.id,
                titulo="Procedimento Privado de Outro Escritorio sobre ISS",
                departamento="fiscal",
                tags="iss, privado",
                status="publicado",
                criado_por="Outro Contador",
                conteudo="Esta informacao pertence a outro escritorio e NAO pode aparecer no RAG!",
            )
            db.add(artigo_outro_tenant)

        db.commit()
        print("   [OK] Artigos tecnicos cadastrados na Base de Conhecimento.")

        # 5. Simula recebimento de mensagem no WhatsApp
        print("\n[3/5] Simulando recebimento de mensagem WhatsApp...")
        telefone_remetente = "11999998888"  # Formato vindo do WhatsApp
        texto_duvida = "Como faco para emitir a nota de servico com retencao de ISS?"
        print(f"   Telefone remetente: {telefone_remetente}")
        print(f"   Texto recebido: \"{texto_duvida}\"")

        # Resolve cliente pelo telefone
        identificado = WhatsAppService.resolver_cliente_por_telefone(db, telefone_remetente)
        assert identificado is not None, "Falha: Cliente deveria ser identificado pelo telefone!"
        resolved_tenant_id, resolved_cliente_id, resolved_cliente = identificado
        print(f"   [OK] Cliente identificado via WhatsAppService: {resolved_cliente.razao_social}")
        print(f"   [OK] Tenant associado: {resolved_tenant_id}")
        assert resolved_tenant_id == tenant_id, "Erro critico: Tenant divergente!"

        # Abre chamado no Helpdesk
        print("\n[4/5] Abrindo chamado no Helpdesk e acionando o Copiloto de IA...")
        solicitacao = Solicitacao(
            tenant_id=resolved_tenant_id,
            cliente_id=resolved_cliente_id,
            cliente_nome=resolved_cliente.razao_social,
            assunto="Duvida: Emissao de nota com retencao de ISS",
            descricao=texto_duvida,
            departamento="fiscal",
            prioridade="media",
            status="aberta",
            criado_por=f"{resolved_cliente.razao_social} (via WhatsApp)",
            origem="whatsapp",
            whatsapp_chat_id=telefone_remetente,
        )
        db.add(solicitacao)
        db.commit()
        db.refresh(solicitacao)
        print(f"   [OK] Chamado aberto no Helpdesk: #{solicitacao.id[:8]} - '{solicitacao.assunto}'")

        # Executa motor de IA (RAG)
        rascunho = AiCopilotService.processar_duvida_e_gerar_rascunho(
            db=db,
            tenant_id=resolved_tenant_id,
            solicitacao_id=solicitacao.id,
            texto_duvida=texto_duvida,
            cliente_nome=resolved_cliente.razao_social,
        )

        # 6. Validações do Rascunho
        print("\n[5/5] Validando integridade do rascunho gerado...")
        assert rascunho.id is not None, "Rascunho nao foi salvo!"
        assert rascunho.tenant_id == tenant_id, "Rascunho salvo sob tenant incorreto!"
        assert rascunho.status == "pendente_aprovacao", "Status deve ser 'pendente_aprovacao'!"
        assert rascunho.despachado_whatsapp is False, "Nao pode despachar antes da aprovacao humana!"

        # Verifica que o artigo do OUTRO tenant NÃO foi incluído nas fontes
        fontes = rascunho.fontes_usadas_json or ""
        assert outro_escritorio.id not in fontes, "VAZAMENTO DE DADOS: Artigo de outro tenant consultado!"
        assert "Outro Escritorio" not in fontes, "VAZAMENTO DE DADOS: Conteudo de outro tenant consultado!"
        print("   [OK] Isolamento Multi-Tenant validado: Zero vazamento de dados entre escritorios.")

        print("\n" + "=" * 70)
        print(">>> TESTE CONCLUIDO COM SUCESSO! DETALHES DO RASCUNHO GERADO:")
        print("=" * 70)
        print(f"ID do Rascunho:      {rascunho.id}")
        print(f"Tenant ID:           {rascunho.tenant_id}")
        print(f"Solicitacao ID:      {rascunho.solicitacao_id}")
        print(f"Status:              {rascunho.status}")
        print(f"Nivel de Confianca:  {rascunho.confianca}")
        print(f"Modelo Utilizado:    {rascunho.modelo_llm}")
        print(f"Fontes RAG Usadas:   {rascunho.fontes_usadas_json}")
        print("\n--- CONTEUDO DA PROPOSTA DE RESPOSTA (HUMAN-IN-THE-LOOP) ---")
        print(rascunho.conteudo_original)
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    rodar_teste()
