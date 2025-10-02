"""
Упрощенная версия FastAPI бэкенда без сложных зависимостей
Только основная функциональность для сохранения маршрутов
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import json
import os
import uuid
from datetime import datetime

# Создаем FastAPI приложение
app = FastAPI(
    title="Рогейн Навигация API (Простая версия)",
    description="Упрощенный API для сохранения маршрутов без сложных зависимостей",
    version="1.0.0-simple"
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Простое файловое хранилище
DATA_DIR = "data"
ROUTES_FILE = os.path.join(DATA_DIR, "routes.json")
TRAINING_FILE = os.path.join(DATA_DIR, "training.json")

# Создаем директорию для данных
os.makedirs(DATA_DIR, exist_ok=True)

# Инициализируем файлы если их нет
if not os.path.exists(ROUTES_FILE):
    with open(ROUTES_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False)

if not os.path.exists(TRAINING_FILE):
    with open(TRAINING_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False)


# Pydantic модели
class PointCoordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class RouteBounds(BaseModel):
    sw_lat: float = Field(..., ge=-90, le=90)
    sw_lng: float = Field(..., ge=-180, le=180)
    ne_lat: float = Field(..., ge=-90, le=90)
    ne_lng: float = Field(..., ge=-180, le=180)


class RouteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    bounds: RouteBounds
    start_point: PointCoordinate
    points: List[PointCoordinate] = Field(..., min_length=1, max_length=50)
    difficulty_level: int = Field(1, ge=1, le=5)
    estimated_time_minutes: Optional[int] = Field(None, ge=1, le=1440)
    is_public: bool = Field(True)


class RouteResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    bounds: RouteBounds
    start_point: PointCoordinate
    points: List[PointCoordinate]
    points_count: int
    difficulty_level: int
    estimated_time_minutes: Optional[int]
    is_public: bool
    created_at: str
    views_count: int = 0


# Утилитарные функции
def load_routes() -> List[Dict]:
    """Загрузить маршруты из файла"""
    try:
        with open(ROUTES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []


def save_routes(routes: List[Dict]):
    """Сохранить маршруты в файл"""
    with open(ROUTES_FILE, 'w', encoding='utf-8') as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)


def load_training_sessions() -> List[Dict]:
    """Загрузить тренировки из файла"""
    try:
        with open(TRAINING_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []


def save_training_sessions(sessions: List[Dict]):
    """Сохранить тренировки в файл"""
    with open(TRAINING_FILE, 'w', encoding='utf-8') as f:
        json.dump(sessions, f, ensure_ascii=False, indent=2)


# API Endpoints
@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "message": "🎯 Рогейн Навигация API (Простая версия) работает!",
        "version": "1.0.0-simple",
        "docs": "/docs",
        "storage": "JSON файлы",
        "endpoints": {
            "routes": "/api/routes",
            "training": "/api/training"
        }
    }


@app.get("/health")
async def health_check():
    """Проверка здоровья сервиса"""
    routes_count = len(load_routes())
    training_count = len(load_training_sessions())
    
    return {
        "status": "healthy",
        "service": "rogaine-navigation-simple-api",
        "storage": {
            "routes_count": routes_count,
            "training_count": training_count,
            "data_directory": DATA_DIR
        }
    }


@app.get("/api/routes", response_model=List[RouteResponse])
async def get_routes(
    limit: int = 20,
    search: Optional[str] = None
):
    """Получить список маршрутов"""
    routes = load_routes()
    
    # Простая фильтрация по названию
    if search:
        routes = [r for r in routes if search.lower() in r.get('title', '').lower()]
    
    # Ограничиваем количество
    routes = routes[:limit]
    
    return routes


@app.post("/api/routes", response_model=RouteResponse)
async def create_route(route_data: RouteCreate):
    """Создать новый маршрут"""
    routes = load_routes()
    
    # Создаем новый маршрут
    new_route = {
        "id": str(uuid.uuid4()),
        "title": route_data.title,
        "description": route_data.description,
        "bounds": route_data.bounds.model_dump(),
        "start_point": route_data.start_point.model_dump(),
        "points": [p.model_dump() for p in route_data.points],
        "points_count": len(route_data.points),
        "difficulty_level": route_data.difficulty_level,
        "estimated_time_minutes": route_data.estimated_time_minutes,
        "is_public": route_data.is_public,
        "created_at": datetime.now().isoformat(),
        "views_count": 0
    }
    
    # Добавляем в список
    routes.append(new_route)
    save_routes(routes)
    
    return new_route


@app.get("/api/routes/{route_id}", response_model=RouteResponse)
async def get_route(route_id: str):
    """Получить маршрут по ID"""
    routes = load_routes()
    
    # Ищем маршрут
    route = next((r for r in routes if r["id"] == route_id), None)
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    # Увеличиваем счетчик просмотров
    route["views_count"] = route.get("views_count", 0) + 1
    save_routes(routes)
    
    return route


@app.delete("/api/routes/{route_id}")
async def delete_route(route_id: str):
    """Удалить маршрут"""
    routes = load_routes()
    
    # Ищем и удаляем маршрут
    route_index = next((i for i, r in enumerate(routes) if r["id"] == route_id), None)
    
    if route_index is None:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    deleted_route = routes.pop(route_index)
    save_routes(routes)
    
    return {"message": f"Маршрут '{deleted_route['title']}' удален"}


@app.post("/api/routes/{route_id}/share")
async def create_route_share(route_id: str):
    """Создать ссылку для обмена маршрутом"""
    routes = load_routes()
    
    # Проверяем существование маршрута
    route = next((r for r in routes if r["id"] == route_id), None)
    
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    
    # Простая ссылка (в реальности нужно создавать токены)
    share_url = f"/shared/{route_id}"
    
    return {
        "share_token": route_id,  # Упрощенно используем ID маршрута
        "share_url": share_url,
        "full_url": f"http://localhost:8001{share_url}",
        "expires_at": None  # Без истечения для простоты
    }


@app.get("/shared/{route_id}")
async def get_shared_route(route_id: str):
    """Получить маршрут по ссылке обмена"""
    # Перенаправляем на обычное получение маршрута
    return await get_route(route_id)


# Простые endpoints для тренировок
@app.get("/api/training")
async def get_training_sessions():
    """Получить историю тренировок"""
    sessions = load_training_sessions()
    return {"sessions": sessions, "count": len(sessions)}


@app.post("/api/training")
async def create_training_session(
    route_id: str,
    started_at: Optional[str] = None
):
    """Начать новую тренировку"""
    sessions = load_training_sessions()
    
    new_session = {
        "id": str(uuid.uuid4()),
        "route_id": route_id,
        "started_at": started_at or datetime.now().isoformat(),
        "finished_at": None,
        "points_visited": 0,
        "points_total": 0,
        "status": "in_progress"
    }
    
    sessions.append(new_session)
    save_training_sessions(sessions)
    
    return new_session


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8001)
