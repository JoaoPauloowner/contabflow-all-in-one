import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes.api import api_router
from app.database.session import Base, engine
import app.models  # Garante registro de todas as tabelas no metadata do SQLAlchemy

# Configuração de logs estruturados
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("contabflow.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação: startup e shutdown."""
    # === STARTUP ===
    logger.info("Inicializando esquema do banco de dados ContabFlow All-in-One...")
    Base.metadata.create_all(bind=engine)
    logger.info("Esquema do banco pronto para receber conexões.")

    # Inicia o CronScheduler em segundo plano
    from app.services.scheduler import cron_scheduler
    await cron_scheduler.start()
    logger.info("CronScheduler de cobrança diária ativado.")

    yield

    # === SHUTDOWN ===
    from app.services.scheduler import cron_scheduler as scheduler_ref
    await scheduler_ref.stop()
    logger.info("CronScheduler finalizado com sucesso.")


# Inicialização da aplicação FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend Unificado ContabFlow All-in-One: Gestão Fiscal, WhatsApp Bridge, Helpdesk com IA, Documentos, Tarefas e Cobrança Automática.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Configuração de CORS para comunicação segura com Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão do roteador central de APIs
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Monitoramento"])
def health_check():
    """Endpoint de verificação de integridade da API."""
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
