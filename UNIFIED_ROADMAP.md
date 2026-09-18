# 🗺️ UNIFIED_ROADMAP.md
## Roteiro de Execução da Fusão All-in-One
### ContabFlow All-in-One — Da Estrutura de Dados à Experiência do Usuário

---

### 📌 Passo 1: Estrutura de Banco de Dados e Schemas no Backend
*Status: ✅ Concluído*

* **Objetivo:** Estabelecer os alicerces de dados do Helpdesk e Copiloto de IA compatíveis com a arquitetura multi-tenant do ContabFlow.
* **Entregas:**
  * Modelos SQLAlchemy com `tenant_id` indexado:
    * `Solicitacao` e `MensagemSolicitacao` (chamados, histórico e mídias).
    * `Tarefa` (atividades internas da equipe contábil).
    * `ArtigoConhecimento` (base corporativa de manuais contábeis/fiscais).
    * `RascunhoIA` (sugestões da IA com suporte ao fluxo Human-in-the-Loop).
  * Schemas Pydantic v2 correspondentes com validação de tipos, enums e suporte ORM (`from_attributes=True`).
  * Isolamento rigoroso garantido pela herança de `TenantModelMixin`.

---

### 🚀 Passo 2: Endpoints REST e Roteamento Inteligente do Webhook
*Status: 🟡 Em Execução*

* **Objetivo:** Expor APIs protegidas para gestão de solicitações, geração de rascunhos de IA e inteligência no Webhook do WhatsApp.
* **Entregas Programadas:**
  * **Router de Solicitações (`routes/solicitacoes.py`):**
    * Abertura de novos chamados (via portal ou integração).
    * Listagem filtrada por status, prioridade e departamento com isolamento `tenant_id`.
    * Consulta detalhada com mensagens da timeline e tarefas associadas.
    * Adição de mensagens com suporte a mídias e notas internas.
  * **Router do Copiloto de IA (`routes/ia_copiloto.py`):**
    * Busca semântica de artigos na Base de Conhecimento.
    * Geração assíncrona de rascunhos de resposta baseados em RAG.
    * Endpoints de edição humana e aprovação/rejeição de rascunhos.
  * **Webhook Unificado do WhatsApp (`routes/webhook_unificado.py`):**
    * Identificação do cliente e do escritório (`tenant_id`) pelo número de telefone normalizado (E.164).
    * Roteamento inteligente de conteúdo:
      * *Mídias (XML, PDF, comprovantes):* Armazenamento e catalogação no módulo fiscal/documental.
      * *Mensagens de texto com dúvidas:* Abertura automática de chamado no Helpdesk e acionamento do Copiloto de IA para gerar o rascunho de resposta para revisão do contador.
  * **Tenant Guard:** Todas as rotas autenticadas protegidas por validação JWT e restrição multi-tenant.

---

### 🖥️ Passo 3: Telas Unificadas & Cockpit 360° no Frontend Next.js 15
*Status: 📋 Planejado (Próxima Etapa)*

* **Objetivo:** Criar uma experiência de uso fluida e moderna tanto para a equipe do escritório quanto para as empresas clientes.
* **Entregas Programadas:**
  * **Login Unificado:** Rota `/login` que detecta a role do usuário e redireciona para `/cockpit` ou `/cliente`.
  * **Cockpit 360° do Contador (`/cockpit`):**
    * Dashboard unificado: resumo fiscal (impostos a vencer) + resumo de atendimento (chamados pendentes e SLA).
    * Visão Helpdesk: Caixa de entrada com triagem e editor de mensagens.
    * Visão Copiloto IA: Fila de rascunhos pendentes com botão de aprovação em 1 clique.
    * Visão Fiscal: Gestão de guias, auditoria de notas XML e régua de cobrança.
    * Visão WhatsApp: Pareamento por QR Code e histórico ao vivo.
  * **Portal do Cliente (`/cliente`):**
    * Meus impostos a pagar com chave PIX copia e cola.
    * Upload drag & drop de documentos fiscais.
    * Aba de suporte com histórico de chamados e dúvidas.

---

### 🧪 Passo 4: Testes Automatizados, Homologação & Hardening
*Status: 🔮 Visão de Consolidação*

* **Objetivo:** Garantir a estabilidade e conformidade da plataforma antes do lançamento comercial.
* **Entregas Programadas:**
  * Testes de integração cobrindo o fluxo: WhatsApp ➔ Webhook ➔ Chamado ➔ Rascunho IA ➔ Aprovação Humana ➔ Despacho no WhatsApp.
  * Verificação de vazamento de dados entre tenants com testes automatizados no Pytest.
  * Validação de sanitização de dados fiscais (LGPD).
