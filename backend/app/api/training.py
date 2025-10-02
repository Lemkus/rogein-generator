"""
API endpoints для тренировочных сессий
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.training import TrainingSession

router = APIRouter()


@router.get("/")
async def get_training_sessions(
    db: AsyncSession = Depends(get_db)
):
    """
    Получить историю тренировок пользователя
    TODO: Добавить аутентификацию и фильтрацию по пользователю
    """
    query = select(TrainingSession).order_by(TrainingSession.created_at.desc())
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    return {"sessions": sessions, "message": "TODO: Добавить схемы и аутентификацию"}


@router.post("/")
async def create_training_session(
    db: AsyncSession = Depends(get_db)
):
    """
    Начать новую тренировочную сессию
    TODO: Реализовать создание сессии
    """
    return {"message": "Создание тренировки - TODO"}


@router.put("/{session_id}")
async def update_training_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Обновить/завершить тренировочную сессию
    TODO: Реализовать обновление сессии
    """
    return {"message": f"Обновление тренировки {session_id} - TODO"}


@router.get("/{session_id}")
async def get_training_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить детали конкретной тренировки
    TODO: Реализовать получение деталей
    """
    return {"message": f"Детали тренировки {session_id} - TODO"}


@router.get("/stats")
async def get_training_stats(
    db: AsyncSession = Depends(get_db)
):
    """
    Получить статистику тренировок пользователя
    TODO: Реализовать статистику
    """
    return {"message": "Статистика тренировок - TODO"}
