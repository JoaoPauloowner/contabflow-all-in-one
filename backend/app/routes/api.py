from fastapi import APIRouter
from app.routes import (
    auth,
    clientes,
    solicitacoes,
    ia_copiloto,
    webhook_unificado,
    impostos,
    documentos,
    dashboard,
    tarefas,
    conhecimento,
)

api_router = APIRouter()

# 1. Autenticação e Gestão de Usuários
api_router.include_router(auth.router)

# 2. Gestão de Clientes do Escritório (Multi-Tenant)
api_router.include_router(clientes.router)

# 3. Helpdesk & Central de Atendimento
api_router.include_router(solicitacoes.router)

# 4. Copiloto de IA & Base de Conhecimento (Human-in-the-Loop)
api_router.include_router(ia_copiloto.router)

# 5. Webhook Unificado do WhatsApp & Automações
api_router.include_router(webhook_unificado.router)

# 6. Gestão de Impostos & Guias Fiscais
api_router.include_router(impostos.router)

# 7. Documentos Fiscais & Uploads
api_router.include_router(documentos.router)

# 8. Dashboards & Cockpit 360°
api_router.include_router(dashboard.router)

# 9. Gestão de Tarefas Internas da Equipe
api_router.include_router(tarefas.router)

# 10. Base de Conhecimento & Procedimentos Internos
api_router.include_router(conhecimento.router)
