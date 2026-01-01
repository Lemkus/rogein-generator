# Dev/Prod окружения

## Обзор

Проект поддерживает два окружения:
- **PROD** (`trailspot.app`) - продакшн окружение для пользователей
- **DEV** (`dev.trailspot.app`) - окружение для разработки и тестирования

## Архитектура

### Отдельные поддомены
- **PROD**: `https://trailspot.app`
- **DEV**: `https://dev.trailspot.app`

### Отдельные папки на сервере
```
~/www/
├── trailspot.app/          # PROD
│   ├── routes_storage.json
│   ├── venv/
│   └── ...
└── dev.trailspot.app/      # DEV
    ├── routes_storage_dev.json
    ├── venv/
    └── ...
```

### Автоматическое определение окружения

Код автоматически определяет окружение по домену:
- `dev.trailspot.app` → DEV окружение
- `trailspot.app` → PROD окружение

## Что разделено между окружениями

### 1. Storage файлы
- **PROD**: `routes_storage.json`
- **DEV**: `routes_storage_dev.json`

### 2. Service Worker кэши
- **PROD**: `rogein-v{version}`
- **DEV**: `rogein-dev-v{version}`

### 3. CORS настройки
- Разрешены оба домена для безопасности
- DEV также разрешает `localhost` для локальной разработки

### 4. Короткие ссылки
- Генерируются с правильным доменом в зависимости от окружения

## Деплой

### Деплой в PROD
```bash
python deploy_regru.py --env prod
# или просто
python deploy_regru.py
```

### Деплой в DEV
```bash
python deploy_regru.py --env dev
```

## Первоначальная настройка DEV окружения

### 1. Создание поддомена в панели REG.RU

1. Войдите в панель управления REG.RU
2. Перейдите в раздел "Сайты" → "Добавить"
3. Выберите "Поддомен"
4. Укажите:
   - Имя поддомена: `dev`
   - Домен: `trailspot.app`
   - Корневая папка: `www/dev.trailspot.app`
   - Python: включено (версия 3.8.8 или выше)
   - SSL: включено (самоподписанный или Let's Encrypt)
   - Кеширование: **отключено** (для dev)
   - HSTS: **отключено** (если используется самоподписанный сертификат)

### 2. Первый деплой в DEV
```bash
python deploy_regru.py --env dev
```

### 3. Настройка виртуального окружения (если нужно)
```bash
# На сервере
cd ~/www/dev.trailspot.app
chmod +x setup_venv.sh
./setup_venv.sh
```

## Проверка работы

### PROD
```bash
curl -I https://trailspot.app/
# Проверка storage
ssh user@server "ls -la ~/www/trailspot.app/routes_storage.json"
```

### DEV
```bash
curl -I https://dev.trailspot.app/
# Проверка storage
ssh user@server "ls -la ~/www/dev.trailspot.app/routes_storage_dev.json"
```

## Безопасность

✅ **Что сделано для безопасности:**
- Отдельные storage файлы (данные не смешиваются)
- Отдельные Service Worker кэши (не конфликтуют)
- Отдельные виртуальные окружения
- Правильные CORS настройки
- Правильные домены в коротких ссылках

⚠️ **Важно:**
- DEV окружение не должно использоваться пользователями
- Storage файлы не синхронизируются между окружениями
- Изменения в DEV не влияют на PROD

## Типичные проблемы

### Проблема: DEV показывает данные PROD
**Причина**: Неправильное определение окружения или общий storage файл

**Решение**: 
1. Проверьте, что поддомен создан правильно
2. Убедитесь, что используется `routes_storage_dev.json` в DEV
3. Проверьте логи: `tail -f ~/www/dev.trailspot.app/error.log`

### Проблема: Service Worker кэши конфликтуют
**Причина**: Одинаковые имена кэшей

**Решение**: Проверьте, что в `sw.js` используется правильное определение окружения:
```javascript
const IS_DEV = self.location.hostname.startsWith('dev.');
const CACHE_NAME = IS_DEV 
  ? `rogein-dev-v${APP_VERSION}` 
  : `rogein-v${APP_VERSION}`;
```

## Рекомендации по работе

1. **Разработка**: Работайте в DEV окружении, тестируйте изменения
2. **Деплой**: Сначала деплойте в DEV, проверьте работу
3. **PROD**: Деплойте в PROD только после проверки в DEV
4. **Ветки Git**: Используйте отдельные ветки для dev и prod (см. [GIT_BRANCHES.md](./GIT_BRANCHES.md))

