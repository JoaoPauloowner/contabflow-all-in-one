# 🏢 ContabFlow All-in-One

Plataforma unificada de **Gestão Fiscal**, **Automação de WhatsApp** e **Helpdesk Contábil com Copiloto de IA Assistida** (*Human-in-the-Loop*).

---

## 🌐 Endpoints em Produção

| Serviço | Plataforma | URL / Endpoint |
| :--- | :--- | :--- |
| **Frontend Web** | Vercel | [https://contabflow-all-in-one.vercel.app](https://contabflow-all-in-one.vercel.app) |
| **Backend API (FastAPI)** | Railway | [https://backend-production-d937.up.railway.app](https://backend-production-d937.up.railway.app) |
| **Documentação Interativa (Swagger)** | Railway | [https://backend-production-d937.up.railway.app/docs](https://backend-production-d937.up.railway.app/docs) |
| **Evolution API (WhatsApp Engine)** | Railway | [https://evolution-api-production-c183.up.railway.app](https://evolution-api-production-c183.up.railway.app) |
| **Evolution Manager** | Railway | [https://evolution-api-production-c183.up.railway.app/manager](https://evolution-api-production-c183.up.railway.app/manager) |
| **PostgreSQL Database** | Railway | `postgres.railway.internal:5432` |
| **Redis Cache** | Railway | `redis.railway.internal:6379` |

---

## 🚀 Principais Recursos

1. **Central de Atendimento & Dúvidas (*Inbox Zero*):**
   - Triagem automática por departamento: **Fiscal**, **Folha/DP**, **Societário**, **Contábil**.
   - Abas organizadas: **Pendentes**, **Respondidos** e **Todos**.
2. **Copiloto de IA Human-in-the-Loop:**
   - Leitura de dúvidas do WhatsApp e consulta à Base de Conhecimento RAG do escritório.
   - Geração de rascunhos de resposta prontos com aprovação em 1 clique pelo contador.
3. **Módulo Fiscal & Documentos (OCR):**
   - Extração automática de dados de NF-e, NFS-e, comprovantes e guias de arrecadação.
4. **Conexão WhatsApp Integrada ao Sistema:**
   - Pareamento direto por QR Code na barra de navegação do sistema, com reconexão automática e persistência em Redis.
5. **Gestão de Clientes Multi-Tenant:**
   - Ficha do cliente interativa com edição de dados, controle de regime tributário e atalho para WhatsApp.

---

## 🗺️ Documentação do Projeto
- [UNIFIED_ROADMAP.md](UNIFIED_ROADMAP.md) — Roteiro de execução e marcos concluídos.
- [FUSION_ARCHITECTURE.md](FUSION_ARCHITECTURE.md) — Diagrama e especificação de microsserviços.
- [INTEGRATED_SECURITY.md](INTEGRATED_SECURITY.md) — Diretrizes de segurança e LGPD.
