# Быстрая справка по развертыванию на REG.RU

## ✅ Правильная конфигурация .htaccess

```apache
Options -MultiViews
PassengerEnabled On
# Только эта директива! Остальные запрещены на REG.RU
```

## ❌ Запрещенные директивы (вызывают ошибки)

- `PassengerAppRoot` ❌
- `PassengerAppType` ❌
- `PassengerStartupFile` ❌
- `PassengerPython` ❌

## 📁 Обязательные файлы

1. **`.htaccess`** - только `PassengerEnabled On`
2. **`passenger_wsgi.py`** - WSGI entry point в корне проекта
3. **`backend_simple.py`** - Flask приложение с экспортом `application`
4. **`venv/`** - виртуальное окружение с зависимостями

## 🔧 Первоначальная настройка (только один раз)

```bash
# 1. Создать виртуальное окружение
python3.8 -m venv venv

# 2. Активировать и установить зависимости
source venv/bin/activate
pip install -r requirements.txt

# 3. Перезапустить Passenger
touch passenger_wsgi.py
```

⚠️ **Выполняется только при первом развертывании!**

## 🐛 Типичные ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| 500 Internal Server Error | Неправильный .htaccess | Оставить только `PassengerEnabled On` |
| "PassengerAppRoot not allowed" | Запрещенная директива | Удалить все директивы кроме `PassengerEnabled On` |
| Import Error | Нет venv или зависимостей | Создать venv и установить `pip install -r requirements.txt` |
| 405 Method Not Allowed | Двойной `/api/api/` в URL | Проверить `BACKEND_SIMPLE_BASE` в `config.js` |

## 📝 Проверка конфигурации

```bash
# Проверка .htaccess
grep Passenger .htaccess
# Должно быть: PassengerEnabled On

# Проверка API
curl -I https://trailspot.app/
# Должен быть: HTTP/1.1 200 OK

# Проверка логов
tail -f /var/www/u3288673/data/logs/trailspot.app.error.log
```

## 🚀 Ежедневный деплой

✅ **Оптимизированный процесс** - скрипт автоматически проверяет окружение и не создает его заново

### Деплой в PROD
```bash
# 1. Коммит изменений
git add .
git commit -m "Описание"
git push

# 2. Деплой в PROD
python deploy_regru.py --env prod
# или просто
python deploy_regru.py
```

### Деплой в DEV
```bash
# 1. Коммит изменений
git add .
git commit -m "Описание"
git push

# 2. Деплой в DEV
python deploy_regru.py --env dev
```

**Что делает скрипт:**
- ✅ Загружает файлы на сервер
- ✅ Автоматически определяет путь (PROD или DEV)
- ✅ Проверяет наличие `venv` (не создает заново, если уже есть)
- ✅ Обновляет зависимости только при необходимости
- ✅ Перезапускает Passenger автоматически

### Ручной перезапуск (если нужно)
```bash
# PROD
ssh user@server "cd www/trailspot.app && touch passenger_wsgi.py"

# DEV
ssh user@server "cd www/dev.trailspot.app && touch passenger_wsgi.py"
```

## 📚 Полная документация

См. [REG_RU_DEPLOYMENT.md](./REG_RU_DEPLOYMENT.md) для подробной информации.

