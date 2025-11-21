"""
Конфигурация приложения
Настройки для базы данных, аутентификации и других компонентов
"""

import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Настройки приложения из переменных окружения"""
    
    # Основные настройки
    APP_NAME: str = "Рогейн Навигация API"
    DEBUG: bool = True
    HOST: str = "localhost"
    PORT: int = 8001
    
    # База данных
    DATABASE_URL: str = "sqlite+aiosqlite:///./rogaine.db"
    # Для PostgreSQL: "postgresql+asyncpg://user:password@localhost/rogaine_db"
    
    # Безопасность (TODO: добавить JWT позже)
    # SECRET_KEY должен быть установлен через переменную окружения
    SECRET_KEY: str = os.getenv("SECRET_KEY") or ""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.SECRET_KEY:
            import warnings
            warnings.warn(
                "SECRET_KEY не установлен! Установите его через переменную окружения SECRET_KEY "
                "или в файле .env. В production это обязательно!",
                UserWarning
            )
    # ALGORITHM: str = "HS256"  # Отключено пока нет JWT
    # ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Redis (для кэширования)
    REDIS_URL: Optional[str] = None
    
    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:8000", "http://127.0.0.1:8000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Глобальный объект настроек
settings = Settings()
