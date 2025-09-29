# Simple Backend для Рогейн Проекта

Python backend сервер для быстрой загрузки данных OpenStreetMap через Overpass API.
Упрощенная версия без сложных зависимостей.

## 🚀 Установка

### 1. Установка Python зависимостей

```bash
# Установка через pip
pip install -r requirements.txt

# Или установка в виртуальном окружении (рекомендуется)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate     # Windows

pip install -r requirements.txt
```

### 2. Проверка установки зависимостей

```python
import flask
import requests
print(f"Flask версия: {flask.__version__}")
print(f"Requests версия: {requests.__version__}")
```

## 🏃 Запуск сервера

```bash
python backend_simple.py
```

Сервер запустится на `http://localhost:5000`

## 📡 API Endpoints

### Проверка состояния
```
GET /api/health
```

### Получение пешеходных маршрутов
```
GET /api/paths?bbox=south,west,north,east
```

### Получение барьеров
```
GET /api/barriers?bbox=south,west,north,east
```

### Получение всех данных
```
GET /api/all?bbox=south,west,north,east
```

## 📊 Формат bbox

bbox должен быть в формате: `south,west,north,east`

Пример: `55.7,37.5,55.8,37.6` (Москва)

## 🔧 Конфигурация

### Настройки OSMnx

В файле `backend_osmnx.py` можно изменить:

```python
# Включение кэширования (по умолчанию включено)
ox.config(use_cache=True, log_console=True)

# Настройки сервера
app.run(
    host='0.0.0.0',    # Доступ со всех IP
    port=5000,         # Порт
    debug=True,        # Режим отладки
    threaded=True      # Многопоточность
)
```

## 📈 Производительность

### Ожидаемые улучшения:

- **Скорость загрузки**: 3-5x быстрее чем Overpass API
- **Качество данных**: Автоматическая фильтрация и очистка
- **Кэширование**: Повторные запросы выполняются мгновенно
- **Параллельность**: Одновременная загрузка разных типов данных

### Мониторинг:

Сервер логирует:
- Время загрузки данных
- Количество найденных объектов
- Ошибки и предупреждения

## 🐛 Отладка

### Проверка логов:

```bash
# Запуск с подробными логами
python backend_osmnx.py
```

### Тестирование API:

```bash
# Проверка состояния
curl http://localhost:5000/api/health

# Тестирование загрузки данных
curl "http://localhost:5000/api/paths?bbox=55.7,37.5,55.8,37.6"
```

## 🔄 Интеграция с Frontend

Backend автоматически работает как fallback для существующего Overpass API.

Если backend недоступен, frontend автоматически переключится на Overpass API.

## 🔧 Диагностика проблем

### Ошибка "OSMnx Backend недоступен"

Если в консоли браузера видны ошибки:
```
❌ OSMnx Backend недоступен (быстрая проверка)
⚠️ OSMnx backend недоступен - используется Overpass API
```

**Возможные причины:**

1. **Backend не запущен**:
   ```bash
   # Проверить, запущен ли backend
   curl http://localhost:5000/api/health
   
   # Если ошибка "Connection refused", запустить backend:
   cd "Проект Рогейн"
   python backend_osmnx.py
   ```

2. **Неправильный порт**:
   - Backend должен работать на порту 5000
   - Проверить в коде: `OSMNX_API_BASE = 'http://localhost:5000/api'`

3. **Блокировка CORS**:
   - Backend настроен на работу с localhost
   - Убедиться, что frontend открыт через локальный сервер

4. **Проблемы с зависимостями**:
   ```bash
   # Переустановить зависимости
   pip install -r requirements.txt
   ```

### Детальная диагностика в консоли

После обновления кода `osmnxAPI.js` в консоли браузера будет показана детальная диагностика:

```
🔍 Быстрая проверка OSMnx backend...
🔄 Полная проверка доступности: попытка 1/1 - http://localhost:5000/api/health
📡 Полная проверка доступности: получен ответ HTTP 200 OK
📄 Полная проверка доступности: тело ответа: {"success": true, "message": "OSMnx Backend is running"}
✅ OSMnx Backend доступен: {success: true, message: "OSMnx Backend is running"}
```

Или в случае ошибки:
```
🔍 Быстрая проверка OSMnx backend...
❌ OSMnx Backend недоступен (быстрая проверка)
```

### Проверка статуса backend

```bash
# Проверка здоровья
curl http://localhost:5000/api/health

# Ожидаемый ответ:
{"success": true, "message": "OSMnx Backend is running", "version": "1.0"}

# Проверка загрузки данных (небольшая область в СПб)
curl "http://localhost:5000/api/paths?bbox=59.9,30.2,59.95,30.25"
```

## 📝 Примечания

- Первый запрос может быть медленным из-за инициализации OSMnx
- Кэш OSMnx сохраняется между запусками сервера
- Для больших областей может потребоваться время на загрузку
- Сервер автоматически обрабатывает ошибки и возвращает понятные сообщения
- При недоступности backend frontend автоматически использует Overpass API
