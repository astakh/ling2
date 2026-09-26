from pydantic_settings import BaseSettings
from typing import Optional
import os
from pathlib import Path


# Путь к директории, где находится этот файл (backend/)
BACKEND_DIR = Path(__file__).parent.resolve()
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # PostgreSQL (удалённый сервер)
    DATABASE_URL: str = "postgresql+asyncpg://lingoflow:password@localhost:5432/lingoflow"
    
    # Безопасность
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # OpenAI API
    OPENAI_API_KEY: str = ""  # Пусто для тестирования без LLM
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    # Режим работы
    USE_MOCK_LLM: bool = True  # True = использовать моковый LLM без API ключа

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = "utf-8"


settings = Settings()

# Автоматически включить моковый LLM если нет API ключа
if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "sk-your-openai-api-key-here":
    settings.USE_MOCK_LLM = True
