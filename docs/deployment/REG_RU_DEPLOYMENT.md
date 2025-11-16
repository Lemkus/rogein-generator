# Развертывание на REG.RU с Passenger

## Обзор

Этот документ описывает правильную настройку окружения для развертывания Flask приложения на хостинге REG.RU с использованием Passenger WSGI.

## Важные ограничения REG.RU

⚠️ **КРИТИЧЕСКИ ВАЖНО**: На хостинге REG.RU разрешены только **минимальные** директивы Passenger в `.htaccess`. Многие стандартные директивы **запрещены** и вызывают ошибки.

### ❌ Запрещенные директивы Passenger:
- `PassengerAppRoot` - вызывает ошибку "not allowed here"
- `PassengerAppType` - вызывает ошибку "not allowed here"
- `PassengerStartupFile` - вызывает ошибку "not allowed here"
- `PassengerPython` - вызывает ошибку "not allowed here"

### ✅ Разрешенные директивы:
- `PassengerEnabled On` - единственная необходимая директива

Passenger автоматически определяет:
- Тип приложения (WSGI) по наличию `passenger_wsgi.py`
- Путь к приложению (корневая директория сайта)
- Версию Python из виртуального окружения

## Структура файлов

```
trailspot.app/
├── .htaccess              # Минимальная конфигурация Passenger
├── passenger_wsgi.py      # WSGI entry point
├── backend_simple.py      # Flask приложение
├── requirements.txt       # Python зависимости
├── venv/                  # Виртуальное окружение
├── index.html            # Frontend
├── src/                  # Frontend код
└── routes_storage.json   # Хранилище маршрутов (создается автоматически)
```

## Конфигурация .htaccess

### Минимальная рабочая конфигурация

```apache
# Passenger конфигурация для Flask приложения
Options -MultiViews
PassengerEnabled On

# Обработка CORS заголовков
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization"    

# Обработка preflight запросов
RewriteEngine On
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=200,L]

# Запрет кеширования для HTML
<FilesMatch "\.(html|htm)$">
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires 0
</FilesMatch>

# Запрет кеширования для Service Worker
<FilesMatch "sw\.js$">
  Header set Cache-Control "no-cache, no-store, must-revalidate"
  Header set Pragma "no-cache"
  Header set Expires 0
</FilesMatch>

# Кеширование для статических ресурсов с версионированием
<FilesMatch "\.(js|css|png|jpg|jpeg|gif|svg|ico)$">
  Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>

# Все запросы обрабатываются через Passenger WSGI
```

### Ключевые моменты:

1. **Только `PassengerEnabled On`** - никаких других директив Passenger
2. **Passenger автоматически находит `passenger_wsgi.py`** в корне проекта
3. **CORS заголовки** настроены для работы с frontend
4. **Кеширование** настроено для оптимизации производительности

## Настройка виртуального окружения

### 1. Создание виртуального окружения

На сервере REG.RU выполните:

```bash
cd /var/www/u3288673/data/www/trailspot.app
python3.8 -m venv venv
```

### 2. Активация и установка зависимостей

```bash
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Требуемые зависимости (requirements.txt)

```
flask>=2.0.0,<3.0.0
werkzeug>=2.0.0,<3.0.0
flask-cors
requests
```

⚠️ **Важно**: Используйте совместимые версии Flask и Werkzeug. Версии Flask 3.x требуют Werkzeug 3.x, но на REG.RU может быть ограниченная поддержка.

## Конфигурация passenger_wsgi.py

### Структура файла

```python
#!/usr/bin/env python3
"""
WSGI file for Flask application on REG.RU Passenger
"""

import sys
import os
import traceback

# Определяем пути
project_path = os.path.dirname(os.path.abspath(__file__))
venv_path = os.path.join(project_path, 'venv')

# Добавляем путь к виртуальному окружению
if os.path.exists(venv_path):
    # Ищем site-packages для разных версий Python
    for python_version in ['python3.8', 'python3.9', 'python3.10', 'python3.11', 'python3']:
        venv_lib_path = os.path.join(venv_path, 'lib', python_version, 'site-packages')
        if os.path.exists(venv_lib_path):
            sys.path.insert(0, venv_lib_path)
            break
    
    # Добавляем путь к проекту
    if project_path not in sys.path:
        sys.path.insert(0, project_path)

# Импортируем Flask приложение
try:
    from backend_simple import application
except ImportError:
    # Fallback: пытаемся импортировать app
    try:
        from backend_simple import app
        application = app
    except Exception as e:
        # Создаем минимальное приложение для отладки
        from flask import Flask
        app = Flask(__name__)
        
        @app.route('/')
        def error():
            return f'<h1>Import Error</h1><pre>{traceback.format_exc()}</pre>'
        
        application = app
```

### Ключевые моменты:

1. **Автоматический поиск site-packages** - проверяет разные версии Python
2. **Добавление пути проекта** в `sys.path`
3. **Обработка ошибок импорта** с информативными сообщениями
4. **Экспорт `application`** - обязательное имя для Passenger

## Конфигурация backend_simple.py

### Экспорт application для Passenger

В конце файла `backend_simple.py` должно быть:

```python
if __name__ == '__main__':
    # Локальный запуск (для разработки)
    app.run(host='0.0.0.0', port=5000, debug=True)
else:
    # Экспорт для Passenger
    logger.info("Backend модуль загружен для Passenger")
    application = app
```

### Структура маршрутов

Все API маршруты должны начинаться с `/api/`:

```python
@app.route('/api/execute-query', methods=['POST'])
@app.route('/api/save-route', methods=['POST'])
@app.route('/api/r/<route_id>', methods=['GET'])
@app.route('/api/shorten', methods=['POST'])
```

## Проверка конфигурации

### 1. Проверка .htaccess

```bash
# На сервере
cat .htaccess | grep Passenger
# Должно быть только: PassengerEnabled On
```

### 2. Проверка виртуального окружения

```bash
# На сервере
ls -la venv/lib/
# Должна быть папка с версией Python (например, python3.8)
```

### 3. Проверка зависимостей

```bash
# На сервере
source venv/bin/activate
pip list
# Должны быть: flask, werkzeug, flask-cors, requests
```

### 4. Проверка логов

```bash
# На сервере
tail -f /var/www/u3288673/data/logs/trailspot.app.error.log
```

### 5. Тестирование API

```bash
# Проверка главной страницы
curl -I https://trailspot.app/

# Проверка API
curl -X POST https://trailspot.app/api/execute-query \
  -H "Content-Type: text/plain" \
  -d "[out:json];node(around:10,55.7558,37.6173);out;"
```

## Перезапуск приложения

После изменений в коде или конфигурации:

```bash
# Создать файл для перезапуска Passenger
touch tmp/restart.txt

# Или изменить время модификации passenger_wsgi.py
touch passenger_wsgi.py
```

## Типичные ошибки и решения

### Ошибка 500 Internal Server Error

**Причина**: Неправильная конфигурация `.htaccess` или проблемы с импортом модулей.

**Решение**:
1. Проверьте логи: `tail -f /var/www/u3288673/data/logs/trailspot.app.error.log`
2. Убедитесь, что в `.htaccess` только `PassengerEnabled On`
3. Проверьте виртуальное окружение и зависимости

### Ошибка "PassengerAppRoot not allowed here"

**Причина**: Использование запрещенной директивы Passenger.

**Решение**: Удалите все директивы Passenger кроме `PassengerEnabled On`.

### Ошибка "Import Error" или "ModuleNotFoundError"

**Причина**: Неправильный путь к виртуальному окружению или отсутствие зависимостей.

**Решение**:
1. Проверьте структуру `venv/lib/`
2. Убедитесь, что зависимости установлены: `pip install -r requirements.txt`
3. Проверьте `sys.path` в `passenger_wsgi.py`

### Ошибка 405 Method Not Allowed

**Причина**: Неправильный URL в клиентском коде (двойной `/api/api/`).

**Решение**: Проверьте `BACKEND_SIMPLE_BASE` в `src/modules/config.js` и использование в `src/app.js`.

## Конфигурация клиентского кода

### src/modules/config.js

```javascript
export const BACKEND_SIMPLE_BASE = 'https://trailspot.app/api';
```

### Использование в src/app.js

```javascript
// ✅ Правильно
const response = await fetch(`${BACKEND_SIMPLE_BASE}/save-route`, {...});

// ❌ Неправильно (двойной /api/)
const response = await fetch(`${BACKEND_SIMPLE_BASE}/api/save-route`, {...});
```

## Процесс развертывания

1. **Подготовка локально**:
   ```bash
   git add .
   git commit -m "Описание изменений"
   git push
   ```

2. **Деплой на сервер**:
   ```bash
   python deploy_regru.py
   ```

3. **Проверка**:
   ```bash
   curl -I https://trailspot.app/
   ```

4. **Перезапуск при необходимости**:
   ```bash
   ssh user@server "cd www/trailspot.app && touch tmp/restart.txt"
   ```

## Резюме

✅ **Правильная конфигурация**:
- `.htaccess`: только `PassengerEnabled On`
- `passenger_wsgi.py`: правильная настройка путей и импорт
- `backend_simple.py`: экспорт `application` для Passenger
- Виртуальное окружение: создано и зависимости установлены
- Клиентский код: правильные URL без дублирования `/api/`

❌ **Типичные ошибки**:
- Использование запрещенных директив Passenger
- Неправильные пути в `passenger_wsgi.py`
- Двойной `/api/` в URL клиентского кода
- Отсутствие виртуального окружения или зависимостей

## Дополнительные ресурсы

- [Passenger документация](https://www.phusionpassenger.com/docs/)
- [REG.RU документация по Passenger](https://www.reg.ru/support/help/hosting/useful/passenger)
- [Flask WSGI документация](https://flask.palletsprojects.com/en/latest/deploying/)

