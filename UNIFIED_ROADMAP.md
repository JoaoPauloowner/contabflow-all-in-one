# 🗺️ UNIFIED_ROADMAP.md
## Roteiro de Execução da Fusão All-in-One
### ContabFlow All-in-One — Da Estrutura de Dados à Experiência do Usuário em Nuvem

---

### 📌 Passo 1: Estrutura de Banco de Dados e Schemas no Backend
*Status: ✅ Concluído (PostgreSQL Produção)*

* **Objetivo:** Estabelecer os alicerces de dados do Helpdesk e Copiloto de IA compatíveis com a arquitetura multi-tenant do ContabFlow.
* **Entregas Realizadas:**
  * Modelos SQLAlchemy com `tenant_id` indexado e isolamento estrito:
    * `Solicitacao` e `MensagemSolicitacao` (chamados, histórico, mídias e notas).
    * `Tarefa` (atividades internas da equipe contábil).
    * `ArtigoConhecimento` (base corporativa de manuais contábeis/fiscais com suporte a RAG).
    * `RascunhoIA` (sugestões da IA com suporte ao fluxo Human-in-the-Loop).
    * `Cliente`, `Escritorio`, `Documento`, `Imposto`, `MensagemWhatsApp`.
  * Schemas Pydantic v2 correspondentes com validação de tipos, enums e suporte ORM (`from_attributes=True`).
  * Isolamento multi-tenant garantido pela herança de `TenantModelMixin`.

---

### 🚀 Passo 2: Endpoints REST e Roteamento Inteligente do Webhook
*Status: ✅ Concluído (Deploy no Railway)*

* **Objetivo:** Expor APIs protegidas para gestão de solicitações, geração de rascunhos de IA e inteligência no Webhook do WhatsApp.
* **Entregas Realizadas:**
  * **Router de Solicitações (`routes/solicitacoes.py`):**
    * Abertura de novos chamados (via portal ou integração).
    * Listagem filtrada por status (`PENDENTES`, `RESPONDIDOS`, `TODOS`), prioridade e departamento.
    * Consulta detalhada com mensagens da timeline e tarefas associadas.
  * **Router do Copiloto de IA (`routes/ia_copiloto.py`):**
    * Busca contextual na Base de Conhecimento do escritório (RAG).
    * Geração assíncrona em background de rascunhos de resposta com LLMs.
    * Endpoints de edição humana e aprovação/despacho direto no WhatsApp.
  * **Router de Gestão de Clientes (`routes/clientes.py`):**
    * CRUD completo: Criação, Listagem, Atualização (`PUT`) e Exclusão (`DELETE`).
  * **Webhook Unificado do WhatsApp (`routes/webhook_unificado.py`):**
    * Identificação do cliente e do escritório (`tenant_id`) pelo número de telefone normalizado (E.164).
    * Roteamento inteligente de conteúdo:
      * *Mídias (XML, PDF, comprovantes):* Armazenamento e esteira de OCR fiscal.
      * *Mensagens de texto com dúvidas:* Abertura automática de chamado no Helpdesk e acionamento do Copiloto de IA para gerar o rascunho de resposta para revisão do contador.
    * Filtro anti-LID e proteção contra eventos internos de sistema/broadcast do WhatsApp.
  * **Tenant Guard:** Todas as rotas autenticadas protegidas por validação JWT e restrição multi-tenant.

---

### 🖥️ Passo 3: Telas Unificadas & Cockpit 360° no Frontend Next.js 15
*Status: ✅ Concluído (Deploy na Vercel: contabflow-all-in-one.vercel.app)*

* **Objetivo:** Criar uma experiência de uso fluida e moderna tanto para a equipe do escritório quanto para as empresas clientes.
* **Entregas Realizadas:**
  * **Login & Cadastro Unificado (`/login` e `/cadastro`):** Roteamento por perfil de acesso (`ADMIN_ESCRITORIO`, `OPERADOR_ESCRITORIO`, `CLIENTE`).
  * **Cockpit 360° do Contador (`/portal-contador`):**
    * Dashboard unificado com métricas fiscais, chamados ativos e SLA.
    * Central de Atendimento & Dúvidas com filtro *Inbox Zero* (**Pendentes** vs. **Respondidos** vs. **Todos**).
    * Painel do Copiloto IA com rascunho inteligente e botão de aprovação em 1 clique.
    * Módulo Documentos & OCR com auditoria de notas fiscais (XML/PDF) e comprovantes.
    * Base de Conhecimento (IA) para treinamento de regras fiscais e trabalhistas do escritório.
    * Conexão direta com WhatsApp via Modal com QR Code ao vivo e badge de status em tempo real.
    * Ficha do Cliente interativa com edição de dados cadastrais, atalho WhatsApp e exclusão de contatos.
  * **Portal do Cliente (`/portal-cliente`):**
    * Consulta de impostos do mês com PIX copia e cola e linha digitável.
    * Upload drag & drop de documentos e extratos.
    * Abertura e acompanhamento de chamados.

---

### ☁️ Passo 4: Infraestrutura em Nuvem e Alta Disponibilidade
*Status: ✅ Concluído (Railway + Vercel + Evolution API)*

* **Backend & Mensageria (Railway):**
  * **Backend FastAPI:** [https://backend-production-d937.up.railway.app](https://backend-production-d937.up.railway.app)
  * **Evolution API v2.3.7:** [https://evolution-api-production-c183.up.railway.app](https://evolution-api-production-c183.up.railway.app)
  * **PostgreSQL 16:** Persistência relacional isolada por tenant.
  * **Redis Cache:** Persistência de sessões Signal sem erro de `Bad MAC`.
* **Frontend Web (Vercel):**
  * **App URL:** [https://contabflow-all-in-one.vercel.app](https://contabflow-all-in-one.vercel.app)
