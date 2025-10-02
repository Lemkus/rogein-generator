"""
FastAPI бэкенд для приложения генерации точек рогейна
Обеспечивает сохранение маршрутов, обмен данными и историю тренировок
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from contextlib import asynccontextmanager

from app.api import auth, routes, training, export
from app.database import engine, Base
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создаем таблицы при запуске
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Очистка при завершении
    await engine.dispose()


# Создаем FastAPI приложение
app = FastAPI(
    title="Рогейн Навигация API",
    description="API для сохранения маршрутов и результатов тренировок",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роуты API
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(routes.router, prefix="/api/routes", tags=["routes"])
app.include_router(training.router, prefix="/api/training", tags=["training"])
app.include_router(export.router, prefix="/api/export", tags=["export"])

# Статические файлы (если нужно)
# app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    """Корневой эндпоинт для проверки работы API"""
    return {
        "message": "🎯 Рогейн Навигация API работает!",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "auth": "/api/auth",
            "routes": "/api/routes", 
            "training": "/api/training",
            "export": "/api/export"
        }
    }


@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    return {"status": "healthy", "service": "rogaine-navigation-api"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
