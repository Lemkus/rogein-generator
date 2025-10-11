# Инструкция по деплою на Amvera

## Что уже готово ✅

1. **Git репозиторий инициализирован** - все файлы добавлены и закоммичены
2. **Конфигурация Amvera создана** - файл `amvera.yaml` настроен для FastAPI
3. **Requirements.txt обновлен** - добавлены FastAPI, uvicorn, pydantic
4. **Структура проекта готова** - фронтенд (HTML/JS) + бэкенд (Python FastAPI)

## Следующие шаги для деплоя на Amvera

### Шаг 1: Создать проект на Amvera
1. Зайдите на [amvera.ru](https://amvera.ru)
2. Создайте новый проект
3. Выберите тип: **Python**
4. Скопируйте URL репозитория (будет выглядеть как `https://git.amvera.ru/ваш-ник/имя-проекта`)

### Шаг 2: Добавить Amvera как remote репозиторий
```bash
# В папке RogeinProject выполните:
git remote add amvera https://git.amvera.ru/ваш-ник/имя-проекта
```

### Шаг 3: Запушить код на Amvera
```bash
# Отправить код на Amvera
git push amvera main:master
```

### Шаг 4: Проверить деплой
- Amvera автоматически начнет сборку после push
- Проверьте логи сборки в панели Amvera
- После успешной сборки приложение будет доступно по URL

## Структура проекта для Amvera

```
RogeinProject/
├── amvera.yaml          # Конфигурация Amvera
├── requirements.txt      # Python зависимости
├── index.html           # Главная страница фронтенда
├── src/                 # JavaScript модули
│   ├── app.js
│   └── modules/
└── backend/             # Python бэкенд
    └── app/
        └── simple_main.py # FastAPI приложение
```

## Конфигурация amvera.yaml

```yaml
build:
  commands:
    - pip install -r requirements.txt
    - echo "Build completed"

run:
  command: uvicorn backend.app.simple_main:app --host 0.0.0.0 --port 5000
  port: 5000

environment:
  PYTHONPATH: "/app"
```

## Возможные проблемы и решения

### Если основная ветка называется `main` (а не `master`)
```bash
git push amvera main:master
```

### Если нужно обновить код
```bash
git add .
git commit -m "Описание изменений"
git push amvera main:master
```

### Если сборка не удается
1. Проверьте логи сборки в панели Amvera
2. Убедитесь что `requirements.txt` содержит все нужные зависимости
3. Проверьте что `amvera.yaml` правильно настроен

## Преимущества Amvera

✅ **Автоматическая сборка** - после каждого push  
✅ **Простое управление** - через веб-интерфейс  
✅ **HTTPS из коробки** - SSL сертификаты автоматически  
✅ **Масштабирование** - легко увеличить ресурсы  
✅ **Логи** - удобный просмотр логов приложения  

## Следующие шаги после деплоя

1. **Настроить домен** (если нужен)
2. **Добавить переменные окружения** (если нужны)
3. **Настроить автодеплой** из GitHub (опционально)
4. **Протестировать все функции** приложения
