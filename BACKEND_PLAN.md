# План разработки бэкенда

## 🎯 Основные требования

### **Функциональность:**
1. **Сохранение распределений точек** - пользователь создает маршрут и сохраняет его
2. **Обмен маршрутами** - возможность поделиться ссылкой на маршрут с друзьями
3. **История тренировок** - сохранение результатов каждой сессии навигации
4. **Управление данными** - CRUD операции для маршрутов и тренировок

### **Дополнительные возможности:**
- Статистика и аналитика тренировок
- Рейтинги и комментарии к маршрутам
- Экспорт в GPX/KML форматы
- Поиск маршрутов по критериям

## 🏗️ Архитектура системы

### **Технологический стек:**

#### **Backend:**
- **Python FastAPI** - быстрый, современный веб-фреймворк
- **PostgreSQL** - надежная реляционная БД для структурированных данных
- **Redis** - кэширование и сессии
- **SQLAlchemy** - ORM для работы с БД
- **Pydantic** - валидация данных

#### **Frontend (обновления):**
- Добавить API клиент для общения с бэкендом
- Формы для сохранения/загрузки маршрутов
- Интерфейс истории тренировок

#### **Инфраструктура:**
- **Docker** - контейнеризация
- **nginx** - прокси и статические файлы
- **Let's Encrypt** - SSL сертификаты

## 📊 Модель данных

### **1. Users (Пользователи)**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP
);
```

### **2. Routes (Маршруты/Распределения точек)**
```sql
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Географические данные
    bounds_sw_lat DECIMAL(10,8),
    bounds_sw_lng DECIMAL(11,8), 
    bounds_ne_lat DECIMAL(10,8),
    bounds_ne_lng DECIMAL(11,8),
    
    start_point_lat DECIMAL(10,8),
    start_point_lng DECIMAL(11,8),
    
    -- Точки маршрута (JSON массив)
    points JSONB NOT NULL,
    
    -- Метаданные
    points_count INTEGER,
    difficulty_level INTEGER DEFAULT 1,
    estimated_time_minutes INTEGER,
    
    -- Статистика
    views_count INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    
    -- Флаги
    is_public BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### **3. Training_Sessions (Тренировки)**
```sql
CREATE TABLE training_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    route_id INTEGER REFERENCES routes(id),
    
    -- Результаты тренировки
    started_at TIMESTAMP NOT NULL,
    finished_at TIMESTAMP,
    duration_seconds INTEGER,
    
    -- Статистика навигации
    points_visited INTEGER DEFAULT 0,
    points_total INTEGER,
    success_rate DECIMAL(5,2),
    
    -- Детальные данные (JSON)
    navigation_data JSONB,
    
    -- Геолокация трека
    gps_track JSONB,
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **4. Route_Ratings (Оценки маршрутов)**
```sql
CREATE TABLE route_ratings (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id),
    user_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(route_id, user_id)
);
```

### **5. Route_Shares (Поделиться маршрутом)**
```sql
CREATE TABLE route_shares (
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id),
    share_token VARCHAR(32) UNIQUE NOT NULL,
    created_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 API Endpoints

### **Authentication**
- `POST /api/auth/register` - регистрация пользователя
- `POST /api/auth/login` - авторизация
- `POST /api/auth/logout` - выход
- `GET /api/auth/me` - информация о текущем пользователе

### **Routes Management**
- `GET /api/routes` - список маршрутов (с фильтрами)
- `POST /api/routes` - создание нового маршрута
- `GET /api/routes/{id}` - получение маршрута по ID
- `PUT /api/routes/{id}` - обновление маршрута
- `DELETE /api/routes/{id}` - удаление маршрута
- `POST /api/routes/{id}/share` - создание ссылки для обмена
- `GET /api/routes/shared/{token}` - получение маршрута по ссылке

### **Training Sessions**
- `GET /api/training` - история тренировок пользователя
- `POST /api/training` - начало новой тренировки
- `PUT /api/training/{id}` - обновление/завершение тренировки
- `GET /api/training/{id}` - детали тренировки
- `GET /api/training/stats` - статистика тренировок

### **Ratings & Reviews**
- `POST /api/routes/{id}/rating` - оценить маршрут
- `GET /api/routes/{id}/ratings` - получить оценки маршрута

### **Export**
- `GET /api/routes/{id}/export/gpx` - экспорт в GPX
- `GET /api/routes/{id}/export/kml` - экспорт в KML

## 📁 Структура проекта

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI приложение
│   ├── config.py            # Конфигурация
│   ├── database.py          # Подключение к БД
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py          # Модель пользователя
│   │   ├── route.py         # Модель маршрута
│   │   └── training.py      # Модель тренировки
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py          # Pydantic схемы пользователя
│   │   ├── route.py         # Pydantic схемы маршрута
│   │   └── training.py      # Pydantic схемы тренировки
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py          # Аутентификация
│   │   ├── routes.py        # Маршруты
│   │   ├── training.py      # Тренировки
│   │   └── export.py        # Экспорт данных
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py      # JWT токены, хеширование
│   │   └── dependencies.py  # Зависимости FastAPI
│   └── utils/
│       ├── __init__.py
│       ├── gpx_export.py    # Экспорт в GPX
│       └── geolocation.py   # Геолокационные утилиты
├── alembic/                 # Миграции БД
├── tests/
├── requirements.txt
├── docker-compose.yml
└── Dockerfile
```

## 🔧 Поэтапная реализация

### **Этап 1: Базовая инфраструктура (1-2 дня)**
- ✅ Настройка FastAPI проекта
- ✅ Подключение PostgreSQL
- ✅ Базовые модели данных
- ✅ Docker контейнеризация

### **Этап 2: Аутентификация (1 день)**
- ✅ JWT токены
- ✅ Регистрация/авторизация
- ✅ Middleware для защищенных роутов

### **Этап 3: Маршруты (2-3 дня)**
- ✅ CRUD операции для маршрутов
- ✅ Сохранение распределений точек
- ✅ Система обмена ссылками

### **Этап 4: Тренировки (2 дня)**
- ✅ Сохранение результатов тренировок
- ✅ Статистика и аналитика
- ✅ История сессий

### **Этап 5: Frontend интеграция (2-3 дня)**
- ✅ API клиент в JavaScript
- ✅ Формы сохранения/загрузки
- ✅ Интерфейс истории тренировок

### **Этап 6: Дополнительные фичи (2-3 дня)**
- ✅ Рейтинги и комментарии
- ✅ Экспорт в GPX/KML
- ✅ Поиск и фильтрация

## 💡 Примеры использования

### **Сценарий 1: Создание и сохранение маршрута**
```javascript
// Frontend код
const route = {
    title: "Тренировка в Осиновой роще",
    description: "10 точек для вечерней пробежки",
    bounds: selectedBounds,
    startPoint: startPoint,
    points: generatedPoints,
    difficulty: 2
};

const response = await fetch('/api/routes', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(route)
});

const savedRoute = await response.json();
console.log(`Маршрут сохранен с ID: ${savedRoute.id}`);
```

### **Сценарий 2: Поделиться маршрутом**
```javascript
// Создание ссылки для обмена
const shareResponse = await fetch(`/api/routes/${routeId}/share`, {
    method: 'POST'
});
const shareData = await shareResponse.json();

// Отправляем другу ссылку
const shareUrl = `https://yourapp.com/shared/${shareData.token}`;
navigator.share({
    title: 'Крутой маршрут для рогейна!',
    url: shareUrl
});
```

### **Сценарий 3: Сохранение результата тренировки**
```javascript
// В конце навигационной сессии
const trainingResult = {
    route_id: currentRouteId,
    started_at: sessionStartTime,
    finished_at: new Date(),
    points_visited: visitedPoints.length,
    points_total: totalPoints,
    navigation_data: {
        average_time_per_point: avgTime,
        accuracy_zones_entered: accuracyCount
    }
};

await fetch('/api/training', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(trainingResult)
});
```

## 🔐 Безопасность

- JWT токены для аутентификации
- Валидация всех входных данных через Pydantic
- Rate limiting для API endpoints
- CORS настройки для фронтенда
- SQL injection защита через SQLAlchemy
- Хеширование паролей через bcrypt

## 📈 Масштабирование

- Индексы БД для быстрых запросов
- Redis кэширование популярных маршрутов
- Пагинация для больших списков
- Сжатие JSON данных
- CDN для статических файлов

---

**Готов начать разработку! С чего начнем - с базовой инфраструктуры или сразу с конкретной функциональности?** 🚀
