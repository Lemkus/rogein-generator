"""
API endpoints для экспорта данных
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.route import Route

router = APIRouter()


@router.get("/routes/{route_id}/gpx")
async def export_route_gpx(
    route_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Экспорт маршрута в формат GPX
    TODO: Реализовать генерацию GPX файла
    """
    # Получаем маршрут
    query = select(Route).where(Route.id == route_id)
    result = await db.execute(query)
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    # Увеличиваем счетчик скачиваний
    route.downloads_count += 1
    await db.commit()
    
    return {"message": f"Экспорт GPX для маршрута {route_id} - TODO"}


@router.get("/routes/{route_id}/kml")
async def export_route_kml(
    route_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Экспорт маршрута в формат KML
    TODO: Реализовать генерацию KML файла
    """
    # Получаем маршрут
    query = select(Route).where(Route.id == route_id)
    result = await db.execute(query)
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    # Увеличиваем счетчик скачиваний
    route.downloads_count += 1
    await db.commit()
    
    return {"message": f"Экспорт KML для маршрута {route_id} - TODO"}


@router.get("/training/{session_id}/gpx")
async def export_training_gpx(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Экспорт GPS трека тренировки в GPX
    TODO: Реализовать экспорт трека тренировки
    """
    return {"message": f"Экспорт трека тренировки {session_id} - TODO"}
