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
    
    # GigaChat API
    GIGACHAT_CREDENTIALS: str = ""  # Authorization key для GigaChat
    GIGACHAT_MODEL: str = "GigaChat-2-Max"  # Доступные: GigaChat-2-Max, GigaChat-Plus, GigaChat-Pro, GigaChat-3-Ultra
    GIGACHAT_OAUTH_URL: str = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
    GIGACHAT_API_URL: str = "https://api.giga.chat/v1"
    GIGACHAT_SCOPE: str = "GIGACHAT_API_PERS"  # GIGACHAT_API_PERS, GIGACHAT_API_B2B, GIGACHAT_API_CORP
    
    # Spaced repetition parameters
    MAX_LESSONS: int = 100  # Максимальное количество уроков в день (лимит для пользователя)
    WORDS_PER_LESSON: int = 5  # Количество слов в уроке (по умолчанию)
    REPETITION_INTERVALS: str = "1,2,4,7,14,21,30,45,60,90"  # Интервалы повторения в уроках
    
    # Admin panel
    ADMIN_PASSWORD: str = "admin123"  # Пароль для доступа к админке

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = "utf-8"


settings = Settings()

# Логируем конфигурацию для отладки
print("=" * 70)
print("Configuration loaded:")
print(f"  GIGACHAT_CREDENTIALS: {'[SET]' if settings.GIGACHAT_CREDENTIALS and settings.GIGACHAT_CREDENTIALS != 'your-gigachat-credentials-here' else '[NOT SET]'}")
print(f"  GIGACHAT_MODEL: {settings.GIGACHAT_MODEL}")
print("=" * 70)

# Проверяем наличие credentials
if not settings.GIGACHAT_CREDENTIALS or settings.GIGACHAT_CREDENTIALS == "your-gigachat-credentials-here":
    print("⚠️  WARNING: GIGACHAT_CREDENTIALS not set or equals default value")
    print("⚠️  Please set GIGACHAT_CREDENTIALS in backend/.env")
else:
    print("✅ GIGACHAT_CREDENTIALS is set - using GigaChat API")

print("=" * 70)
