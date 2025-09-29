# 🔧 Решение проблем с OSMnx Backend

## Быстрая диагностика

Если в консоли браузера видите:
```
❌ OSMnx Backend недоступен: Неизвестная ошибка API
⚠️ OSMnx backend недоступен - используется Overpass API
```

## ✅ Шаги решения:

### 1. Проверить, запущен ли backend
```bash
# Откройте командную строку/терминал
curl http://localhost:5000/api/health
```

**Если получили ошибку "Connection refused"** → backend не запущен.

### 2. Запустить backend

У вас есть два варианта backend:

#### Вариант A: OSMnx Backend (рекомендуется)
```bash
# Перейти в папку проекта
cd "C:\Users\PC\Desktop\Проект Рогейн\Проект Рогейн"

# Запустить OSMnx backend
python backend_osmnx.py
```

**Должно появиться:**
```
OSMnx Backend Server запущен на http://localhost:5000
```

#### Вариант B: Simple Backend (если нет OSMnx)
```bash
# Запустить простой backend
python backend_simple.py
```

**Должно появиться:**
```
Simple Backend сервера...
Доступные endpoints:
  GET /api/health - проверка состояния
  GET /api/paths?bbox=... - пешеходные маршруты
  ...
Running on http://0.0.0.0:5000
```

### 3. Проверить снова
```bash
curl http://localhost:5000/api/health
```

**Ожидаемый ответ:**
```json
{"success": true, "message": "OSMnx Backend is running"}
```

### 4. Обновить страницу браузера
После запуска backend обновите страницу с приложением.

## 🔍 Детальная диагностика

После обновления кода теперь в консоли браузера будет показана подробная информация:

### Успешное подключение (OSMnx Backend):
```
🔍 Быстрая проверка OSMnx backend...
🔄 Полная проверка доступности: попытка 1/1 - http://localhost:5000/api/health
📡 Полная проверка доступности: получен ответ HTTP 200 OK
📄 Полная проверка доступности: тело ответа: {"success": true, "message": "OSMnx Backend is running"}
✅ Полная проверка доступности: OSMnx backend формат
✅ OSMnx Backend доступен: {success: true, message: "OSMnx Backend is running"}
```

### Успешное подключение (Simple Backend):
```
🔍 Быстрая проверка OSMnx backend...
🔄 Полная проверка доступности: попытка 1/1 - http://localhost:5000/api/health
📡 Полная проверка доступности: получен ответ HTTP 200 OK
📄 Полная проверка доступности: тело ответа: {"backend_type": "simple_overpass", "status": "healthy", "timestamp": 1759159238.29}
✅ Полная проверка доступности: простой backend формат (simple_overpass)
✅ OSMnx Backend доступен: {success: true, message: "Simple backend (simple_overpass) is healthy"}
```

### Проблемы с подключением:
```
🔍 Быстрая проверка OSMnx backend...
🔄 Полная проверка доступности: попытка 1/1 - http://localhost:5000/api/health
🌐 Полная проверка доступности: ошибка сети - возможно backend не запущен (попытка 1/1): Failed to fetch
❌ OSMnx Backend недоступен (полная проверка): Failed to fetch
```

## 🚀 Альтернативный запуск

Если `python backend_osmnx.py` не работает:

### Windows:
```cmd
python3 backend_osmnx.py
# или
py backend_osmnx.py
```

### Linux/Mac:
```bash
python3 backend_osmnx.py
```

## 📋 Проверочный список

- [ ] Backend запущен (`python backend_osmnx.py`)
- [ ] Порт 5000 свободен
- [ ] Консоль показывает "OSMnx Backend Server запущен на http://localhost:5000"
- [ ] `curl http://localhost:5000/api/health` возвращает успешный ответ
- [ ] Страница браузера обновлена
- [ ] В консоли браузера видно "✅ OSMnx Backend доступен"

## ⚠️ Если все еще не работает

1. **Проверить зависимости:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Проверить порт:**
   - Убедиться, что порт 5000 не занят другим приложением
   - Закрыть другие приложения, использующие порт 5000

3. **Использовать Overpass API:**
   - Приложение автоматически переключится на Overpass API
   - Это будет медленнее, но будет работать

## 🎯 Результат

После успешного запуска backend:
- ✅ Загрузка данных будет **значительно быстрее**
- ✅ Меньше нагрузки на Overpass API
- ✅ Лучшая стабильность соединения
- ✅ В консоли будет показано: "✅ OSMnx: загружено X маршрутов за Y.Zс"
