# Бэкенд для Рогейн Навигации

## 🎯 Функциональность

- **Сохранение маршрутов** - пользователи могут сохранять распределения точек
- **Обмен маршрутами** - создание ссылок для обмена с друзьями
- **История тренировок** - сохранение результатов каждой навигационной сессии
- **Рейтинги и комментарии** - оценка маршрутов другими пользователями
- **Экспорт данных** - GPX/KML форматы для внешних устройств

## 🚀 Быстрый старт

### Вариант 1: Локальная разработка

1. **Установите Python 3.11+** и зависимости:
```bash
cd backend
pip install -r requirements.txt
```

2. **Запустите сервер разработки:**
```bash
uvicorn app.main:app --host localhost --port 8001 --reload
```

3. **Откройте документацию API:**
- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

### Вариант 2: Docker (рекомендуется)

1. **Запустите с Docker Compose:**
```bash
cd backend
docker-compose up -d
```

2. **Проверьте работу:**
- API: http://localhost:8001
- Документация: http://localhost:8001/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## 📊 API Endpoints

### 🗺️ **Маршруты**
- `GET /api/routes` - список маршрутов с фильтрацией
- `POST /api/routes` - создание нового маршрута
- `GET /api/routes/{id}` - получение маршрута по ID
- `PUT /api/routes/{id}` - обновление маршрута
- `DELETE /api/routes/{id}` - удаление маршрута
- `POST /api/routes/{id}/share` - создание ссылки для обмена
- `GET /api/routes/shared/{token}` - получение маршрута по ссылке
- `POST /api/routes/{id}/rating` - оценка маршрута

### 🏃 **Тренировки**
- `GET /api/training` - история тренировок
- `POST /api/training` - начало новой тренировки
- `PUT /api/training/{id}` - завершение тренировки
- `GET /api/training/{id}` - детали тренировки
- `GET /api/training/stats` - статистика тренировок

### 📁 **Экспорт**
- `GET /api/export/routes/{id}/gpx` - экспорт маршрута в GPX
- `GET /api/export/routes/{id}/kml` - экспорт маршрута в KML
- `GET /api/export/training/{id}/gpx` - экспорт трека тренировки

### 🔐 **Аутентификация** (TODO)
- `POST /api/auth/register` - регистрация
- `POST /api/auth/login` - авторизация
- `POST /api/auth/logout` - выход
- `GET /api/auth/me` - текущий пользователь

## 💾 База данных

### Модели:
- **Users** - пользователи системы
- **Routes** - сохраненные маршруты
- **TrainingSessions** - результаты тренировок
- **RouteRatings** - оценки маршрутов
- **RouteShares** - ссылки для обмена

### Схема БД:
```sql
-- Пользователи
users (id, username, email, password_hash, created_at)

-- Маршруты
routes (id, user_id, title, description, bounds, start_point, points, difficulty, rating, created_at)

-- Тренировки
training_sessions (id, user_id, route_id, started_at, finished_at, points_visited, navigation_data, gps_track)

-- Оценки маршрутов
route_ratings (id, route_id, user_id, rating, comment, created_at)

-- Обмен маршрутами
route_shares (id, route_id, share_token, expires_at, access_count)
```

## 🔧 Конфигурация

Настройки в файле `app/config.py`:

```python
class Settings:
    # Основные настройки
    DEBUG: bool = True
    HOST: str = "localhost"
    PORT: int = 8001
    
    # База данных
    DATABASE_URL: str = "sqlite+aiosqlite:///./rogaine.db"
    
    # Безопасность
    SECRET_KEY: str = "your-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:8000"]
```

Для production создайте файл `.env`:
```env
DEBUG=false
DATABASE_URL=postgresql+asyncpg://user:password@localhost/rogaine_db
SECRET_KEY=your-super-secret-key
ALLOWED_ORIGINS=["https://yourdomain.com"]
```

## 🧪 Тестирование API

### Примеры запросов:

**Создание маршрута:**
```bash
curl -X POST "http://localhost:8001/api/routes" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Тренировка в парке",
    "description": "10 точек для вечерней пробежки",
    "bounds": {
      "sw_lat": 60.1,
      "sw_lng": 30.2,
      "ne_lat": 60.12,
      "ne_lng": 30.25
    },
    "start_point": {"lat": 60.11, "lng": 30.22},
    "points": [
      {"lat": 60.111, "lng": 30.221},
      {"lat": 60.112, "lng": 30.222}
    ],
    "difficulty_level": 2
  }'
```

**Получение списка маршрутов:**
```bash
curl "http://localhost:8001/api/routes?difficulty_min=1&difficulty_max=3&page=1&size=10"
```

**Создание ссылки для обмена:**
```bash
curl -X POST "http://localhost:8001/api/routes/1/share" \
  -H "Content-Type: application/json" \
  -d '{"expires_hours": 24}'
```

## 🔄 Интеграция с фронтендом

В фронтенде используйте `apiClient.js`:

```javascript
import { saveCurrentRoute, loadRoute, shareCurrentRoute } from './modules/apiClient.js';

// Сохранение маршрута
const savedRoute = await saveCurrentRoute(bounds, startPoint, points, {
    title: "Мой маршрут",
    difficulty: 2,
    isPublic: true
});

// Загрузка маршрута
const route = await loadRoute(savedRoute.id);

// Обмен маршрутом
const shareData = await shareCurrentRoute(savedRoute.id, 48); // 48 часов
console.log('Ссылка для друга:', shareData.full_url);
```

## 🚧 TODO (Следующие этапы)

1. **JWT Аутентификация** - регистрация и авторизация пользователей
2. **Валидация данных** - более строгие проверки входных данных
3. **Экспорт GPX/KML** - генерация файлов для GPS устройств
4. **Кэширование** - Redis для популярных маршрутов
5. **Тесты** - unit и integration тесты
6. **Документация** - более детальное API описание
7. **Мониторинг** - логирование и метрики
8. **Миграции БД** - Alembic для управления схемой

## 🐛 Отладка

**Проблемы с CORS:**
```bash
# Проверьте настройки CORS в main.py
# Убедитесь что фронтенд запущен на разрешенном домене
```

**Проблемы с БД:**
```bash
# Для SQLite БД создается автоматически
# Для PostgreSQL убедитесь что сервер запущен:
docker-compose up db -d
```

**Логи контейнера:**
```bash
docker-compose logs backend -f
```

---

**Бэкенд готов к использованию! Запустите его и начните сохранять маршруты! 🎯**
