"""
Pydantic схемы для маршрутов
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class PointCoordinate(BaseModel):
    """Координата точки маршрута"""
    lat: float = Field(..., ge=-90, le=90, description="Широта")
    lng: float = Field(..., ge=-180, le=180, description="Долгота")


class RouteBounds(BaseModel):
    """Границы области маршрута"""
    sw_lat: float = Field(..., ge=-90, le=90, description="Юго-западная широта")
    sw_lng: float = Field(..., ge=-180, le=180, description="Юго-западная долгота")
    ne_lat: float = Field(..., ge=-90, le=90, description="Северо-восточная широта")
    ne_lng: float = Field(..., ge=-180, le=180, description="Северо-восточная долгота")


class RouteCreate(BaseModel):
    """Схема для создания маршрута"""
    title: str = Field(..., min_length=1, max_length=200, description="Название маршрута")
    description: Optional[str] = Field(None, max_length=2000, description="Описание маршрута")
    
    bounds: RouteBounds = Field(..., description="Границы области")
    start_point: PointCoordinate = Field(..., description="Стартовая точка")
    points: List[PointCoordinate] = Field(..., min_length=1, max_length=50, description="Точки маршрута")
    
    difficulty_level: int = Field(1, ge=1, le=5, description="Уровень сложности (1-5)")
    estimated_time_minutes: Optional[int] = Field(None, ge=1, le=1440, description="Ожидаемое время в минутах")
    is_public: bool = Field(True, description="Публичный маршрут")


class RouteUpdate(BaseModel):
    """Схема для обновления маршрута"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    difficulty_level: Optional[int] = Field(None, ge=1, le=5)
    estimated_time_minutes: Optional[int] = Field(None, ge=1, le=1440)
    is_public: Optional[bool] = None


class RouteResponse(BaseModel):
    """Схема для возврата данных маршрута"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    title: str
    description: Optional[str]
    
    bounds_sw_lat: Optional[Decimal]
    bounds_sw_lng: Optional[Decimal]
    bounds_ne_lat: Optional[Decimal]
    bounds_ne_lng: Optional[Decimal]
    
    start_point_lat: Optional[Decimal]
    start_point_lng: Optional[Decimal]
    
    points: List[Dict[str, Any]]
    points_count: Optional[int]
    difficulty_level: int
    estimated_time_minutes: Optional[int]
    
    views_count: int
    downloads_count: int
    rating: Optional[Decimal]
    
    is_public: bool
    is_featured: bool
    
    created_at: datetime
    updated_at: Optional[datetime]


class RouteListResponse(BaseModel):
    """Схема для списка маршрутов"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    title: str
    description: Optional[str]
    points_count: Optional[int]
    difficulty_level: int
    estimated_time_minutes: Optional[int]
    rating: Optional[Decimal]
    views_count: int
    is_featured: bool
    created_at: datetime


class RouteShareCreate(BaseModel):
    """Схема для создания ссылки обмена"""
    expires_hours: Optional[int] = Field(None, ge=1, le=8760, description="Срок действия в часах")


class RouteShareResponse(BaseModel):
    """Схема ответа при создании ссылки"""
    model_config = ConfigDict(from_attributes=True)
    
    share_token: str
    expires_at: Optional[datetime]
    share_url: str


class RouteRatingCreate(BaseModel):
    """Схема для создания оценки маршрута"""
    rating: int = Field(..., ge=1, le=5, description="Оценка от 1 до 5")
    comment: Optional[str] = Field(None, max_length=1000, description="Комментарий")


class RouteRatingResponse(BaseModel):
    """Схема для возврата оценки"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime


class RouteSearchFilters(BaseModel):
    """Фильтры для поиска маршрутов"""
    search: Optional[str] = Field(None, max_length=100, description="Поиск по названию/описанию")
    difficulty_min: Optional[int] = Field(None, ge=1, le=5)
    difficulty_max: Optional[int] = Field(None, ge=1, le=5)
    points_min: Optional[int] = Field(None, ge=1)
    points_max: Optional[int] = Field(None, ge=1)
    rating_min: Optional[float] = Field(None, ge=0, le=5)
    is_featured: Optional[bool] = None
    user_id: Optional[int] = None
    
    # Пагинация
    page: int = Field(1, ge=1, description="Номер страницы")
    size: int = Field(20, ge=1, le=100, description="Размер страницы")
