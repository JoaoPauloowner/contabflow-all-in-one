import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "ContabFlow All-in-One"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Segurança e JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "contabflow_all_in_one_master_jwt_secret_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 dias

    # Banco de Dados PostgreSQL Multi-Tenant
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "contabflow_user")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "contabflow_pass123")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "contabflow_all_in_one_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    DATABASE_URL: Union[str, None] = None

    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_connection(cls, v: Union[str, None]) -> str:
        if isinstance(v, str) and v:
            return v
        server = os.getenv("POSTGRES_SERVER", "localhost")
        user = os.getenv("POSTGRES_USER", "contabflow_user")
        password = os.getenv("POSTGRES_PASSWORD", "contabflow_pass123")
        db = os.getenv("POSTGRES_DB", "contabflow_all_in_one_db")
        port = os.getenv("POSTGRES_PORT", "5432")
        return f"postgresql://{user}:{password}@{server}:{port}/{db}"

    # Armazenamento e Uploads
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    MAX_UPLOAD_SIZE_MB: int = 25
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".xml", ".png", ".jpg", ".jpeg", ".csv", ".xlsx", ".ofx"]

    # WhatsApp Bridge (Baileys / Evolution API)
    WHATSAPP_BRIDGE_URL: str = os.getenv("WHATSAPP_BRIDGE_URL", "http://localhost:8085")
    WHATSAPP_INSTANCE_NAME: str = os.getenv("WHATSAPP_INSTANCE_NAME", "contabflow_instance")
    WHATSAPP_WEBHOOK_SECRET: str = os.getenv("WHATSAPP_WEBHOOK_SECRET", "webhook_secret_seguro_2026")
    MOCK_NOTIFICATIONS: bool = os.getenv("MOCK_NOTIFICATIONS", "false").lower() in ("true", "1")

    # Copiloto IA (OpenAI / Gemini / Ollama Local)
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "openai")
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")
    AI_MODEL: str = os.getenv("AI_MODEL", "gpt-4o")
    LOCAL_LLM_URL: str = os.getenv("LOCAL_LLM_URL", "http://localhost:11434")
    LOCAL_LLM_MODEL: str = os.getenv("LOCAL_LLM_MODEL", "llama3.2")
    ENABLE_PII_MASKING: bool = os.getenv("ENABLE_PII_MASKING", "true").lower() in ("true", "1")

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    model_config = SettingsConfigDict(
        env_file=[
            str(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")),
            ".env",
            "backend/.env",
        ],
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
