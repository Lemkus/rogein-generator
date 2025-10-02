"""
API endpoints для работы с маршрутами
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import List, Optional
import secrets
from datetime import datetime, timedelta

from app.database import get_db
from app.models.route import Route, RouteRating, RouteShare
from app.schemas.route import (
    RouteCreate, RouteUpdate, RouteResponse, RouteListResponse,
    RouteShareCreate, RouteShareResponse, RouteRatingCreate, RouteRatingResponse,
    RouteSearchFilters
)

router = APIRouter()


@router.get("/", response_model=List[RouteListResponse])
async def get_routes(
    search: Optional[str] = Query(None, max_length=100),
    difficulty_min: Optional[int] = Query(None, ge=1, le=5),
    difficulty_max: Optional[int] = Query(None, ge=1, le=5),
    points_min: Optional[int] = Query(None, ge=1),
    points_max: Optional[int] = Query(None, ge=1),
    rating_min: Optional[float] = Query(None, ge=0, le=5),
    is_featured: Optional[bool] = Query(None),
    user_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить список маршрутов с фильтрацией и пагинацией
    """
    query = select(Route).where(Route.is_public == True)
    
    # Применяем фильтры
    if search:
        query = query.where(
            or_(
                Route.title.ilike(f"%{search}%"),
                Route.description.ilike(f"%{search}%")
            )
        )
    
    if difficulty_min:
        query = query.where(Route.difficulty_level >= difficulty_min)
    
    if difficulty_max:
        query = query.where(Route.difficulty_level <= difficulty_max)
    
    if points_min:
        query = query.where(Route.points_count >= points_min)
    
    if points_max:
        query = query.where(Route.points_count <= points_max)
    
    if rating_min:
        query = query.where(Route.rating >= rating_min)
    
    if is_featured is not None:
        query = query.where(Route.is_featured == is_featured)
    
    if user_id:
        query = query.where(Route.user_id == user_id)
    
    # Сортировка и пагинация
    query = query.order_by(Route.is_featured.desc(), Route.created_at.desc())
    query = query.offset((page - 1) * size).limit(size)
    
    result = await db.execute(query)
    routes = result.scalars().all()
    
    return routes


@router.post("/", response_model=RouteResponse)
async def create_route(
    route_data: RouteCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Создать новый маршрут
    TODO: Добавить аутентификацию пользователя
    """
    # Временно используем user_id = 1, пока нет аутентификации
    user_id = 1
    
    # Преобразуем точки в формат JSON
    points_json = [{"lat": p.lat, "lng": p.lng} for p in route_data.points]
    
    route = Route(
        user_id=user_id,
        title=route_data.title,
        description=route_data.description,
        bounds_sw_lat=route_data.bounds.sw_lat,
        bounds_sw_lng=route_data.bounds.sw_lng,
        bounds_ne_lat=route_data.bounds.ne_lat,
        bounds_ne_lng=route_data.bounds.ne_lng,
        start_point_lat=route_data.start_point.lat,
        start_point_lng=route_data.start_point.lng,
        points=points_json,
        points_count=len(points_json),
        difficulty_level=route_data.difficulty_level,
        estimated_time_minutes=route_data.estimated_time_minutes,
        is_public=route_data.is_public
    )
    
    db.add(route)
    await db.commit()
    await db.refresh(route)
    
    return route


@router.get("/{route_id}", response_model=RouteResponse)
async def get_route(
    route_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить маршрут по ID
    """
    query = select(Route).where(Route.id == route_id)
    result = await db.execute(query)
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    if not route.is_public:
        # TODO: Проверить права доступа пользователя
        pass
    
    # Увеличиваем счетчик просмотров
    route.views_count += 1
    await db.commit()
    
    return route


@router.put("/{route_id}", response_model=RouteResponse)
async def update_route(
    route_id: int,
    route_update: RouteUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Обновить маршрут
    TODO: Добавить проверку прав доступа
    """
    query = select(Route).where(Route.id == route_id)
    result = await db.execute(query)
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    # TODO: Проверить, что пользователь - владелец маршрута
    
    # Обновляем поля
    update_data = route_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(route, field, value)
    
    await db.commit()
    await db.refresh(route)
    
    return route


@router.delete("/{route_id}")
async def delete_route(
    route_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Удалить маршрут
    TODO: Добавить проверку прав доступа
    """
    query = select(Route).where(Route.id == route_id)
    result = await db.execute(query)
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    # TODO: Проверить, что пользователь - владелец маршрута
    
    await db.delete(route)
    await db.commit()
    
    return {"message": "Маршрут удален"}


@router.post("/{route_id}/share", response_model=RouteShareResponse)
async def create_route_share(
    route_id: int,
    share_data: RouteShareCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Создать ссылку для обмена маршрутом
    """
    # Проверяем существование маршрута
    query = select(Route).where(Route.id == route_id)
    result = await db.execute(query)
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    # Создаем токен обмена
    share_token = secrets.token_urlsafe(16)
    
    # Вычисляем срок действия
    expires_at = None
    if share_data.expires_hours:
        expires_at = datetime.utcnow() + timedelta(hours=share_data.expires_hours)
    
    route_share = RouteShare(
        route_id=route_id,
        created_by=1,  # TODO: Получить из аутентификации
        share_token=share_token,
        expires_at=expires_at
    )
    
    db.add(route_share)
    await db.commit()
    
    # Формируем URL для обмена
    share_url = f"/shared/{share_token}"
    
    return RouteShareResponse(
        share_token=share_token,
        expires_at=expires_at,
        share_url=share_url
    )


@router.get("/shared/{token}", response_model=RouteResponse)
async def get_shared_route(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить маршрут по токену обмена
    """
    query = select(RouteShare).where(RouteShare.share_token == token)
    result = await db.execute(query)
    route_share = result.scalar_one_or_none()
    
    if not route_share:
        raise HTTPException(status_code=404, detail="Ссылка не найдена")
    
    # Проверяем срок действия
    if route_share.expires_at and route_share.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Ссылка истекла")
    
    # Получаем маршрут
    route_query = select(Route).where(Route.id == route_share.route_id)
    route_result = await db.execute(route_query)
    route = route_result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    # Увеличиваем счетчики
    route_share.access_count += 1
    route.views_count += 1
    await db.commit()
    
    return route


@router.post("/{route_id}/rating", response_model=RouteRatingResponse)
async def create_route_rating(
    route_id: int,
    rating_data: RouteRatingCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Оценить маршрут
    TODO: Добавить аутентификацию
    """
    user_id = 1  # TODO: Получить из аутентификации
    
    # Проверяем существование маршрута
    query = select(Route).where(Route.id == route_id)
    result = await db.execute(query)
    route = result.scalar_one_or_none()
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    # Проверяем, не оценивал ли уже пользователь этот маршрут
    existing_query = select(RouteRating).where(
        and_(RouteRating.route_id == route_id, RouteRating.user_id == user_id)
    )
    existing_result = await db.execute(existing_query)
    existing_rating = existing_result.scalar_one_or_none()
    
    if existing_rating:
        # Обновляем существующую оценку
        existing_rating.rating = rating_data.rating
        existing_rating.comment = rating_data.comment
        rating = existing_rating
    else:
        # Создаем новую оценку
        rating = RouteRating(
            route_id=route_id,
            user_id=user_id,
            rating=rating_data.rating,
            comment=rating_data.comment
        )
        db.add(rating)
    
    await db.commit()
    
    # Пересчитываем средний рейтинг маршрута
    avg_query = select(func.avg(RouteRating.rating)).where(RouteRating.route_id == route_id)
    avg_result = await db.execute(avg_query)
    avg_rating = avg_result.scalar()
    
    route.rating = round(float(avg_rating), 2) if avg_rating else 0
    await db.commit()
    await db.refresh(rating)
    
    return rating
