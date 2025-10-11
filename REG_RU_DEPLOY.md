# Инструкция по деплою на REG.RU

## Что уже готово ✅

1. **Flask бэкенд** - `backend_simple.py` с API для OpenStreetMap
2. **WSGI файл** - `passenger_wsgi.py` для REG.RU Passenger
3. **Requirements.txt** - Flask зависимости
4. **Фронтенд** - HTML/JS файлы готовы
5. **Скрипт деплоя** - `deploy_regru.py` для автоматической загрузки

## Настройка SSH ключа

### Шаг 1: Создайте SSH ключ на вашем компьютере

```bash
# Создайте SSH ключ
ssh-keygen -t rsa -b 4096 -f ~/.ssh/trailspot_deploy -N ""

# Покажите публичный ключ
cat ~/.ssh/trailspot_deploy.pub
```

### Шаг 2: Добавьте публичный ключ на сервер REG.RU

1. **Подключитесь к серверу по паролю:**
   ```bash
   ssh u3288673@31.31.196.9
   ```

2. **Создайте директорию .ssh:**
   ```bash
   mkdir -p ~/.ssh
   ```

3. **Добавьте публичный ключ:**
   ```bash
   echo "ВАШ_ПУБЛИЧНЫЙ_КЛЮЧ_СЮДА" >> ~/.ssh/authorized_keys
   ```

4. **Установите права:**
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/authorized_keys
   ```

5. **Выйдите с сервера:**
   ```bash
   exit
   ```

### Шаг 3: Проверьте подключение

```bash
ssh -i ~/.ssh/trailspot_deploy u3288673@31.31.196.9 "echo 'SSH работает!'"
```

## Деплой приложения

### Автоматический деплой (рекомендуется)

```bash
# В папке RogeinProject выполните:
python deploy_regru.py
```

### Ручной деплой

```bash
# Загрузите основные файлы
scp -i ~/.ssh/trailspot_deploy backend_simple.py u3288673@31.31.196.9:www/trailspot.app/
scp -i ~/.ssh/trailspot_deploy passenger_wsgi.py u3288673@31.31.196.9:www/trailspot.app/
scp -i ~/.ssh/trailspot_deploy requirements.txt u3288673@31.31.196.9:www/trailspot.app/
scp -i ~/.ssh/trailspot_deploy index.html u3288673@31.31.196.9:www/trailspot.app/

# Загрузите директорию src
rsync -avz -e 'ssh -i ~/.ssh/trailspot_deploy' src/ u3288673@31.31.196.9:www/trailspot.app/src/
```

## Настройка на сервере

### Подключитесь к серверу и настройте приложение:

```bash
ssh -i ~/.ssh/trailspot_deploy u3288673@31.31.196.9
cd www/trailspot.app

# Установите зависимости
pip3 install -r requirements.txt

# Проверьте права на файлы
chmod +x passenger_wsgi.py
```

## Структура проекта на сервере

```
www/trailspot.app/
├── passenger_wsgi.py      # WSGI файл для Passenger
├── backend_simple.py      # Flask приложение
├── requirements.txt       # Python зависимости
├── index.html            # Главная страница
├── src/                  # JavaScript модули
│   ├── app.js
│   └── modules/
├── favicon.svg           # Иконка
└── manifest.json         # PWA манифест
```

## API Endpoints

После деплоя будут доступны следующие API:

- `GET /api/health` - проверка состояния сервера
- `GET /api/paths?bbox=south,west,north,east` - пешеходные маршруты
- `GET /api/barriers?bbox=south,west,north,east` - барьеры
- `GET /api/closed-areas?bbox=south,west,north,east` - закрытые зоны
- `GET /api/water-areas?bbox=south,west,north,east` - водоёмы
- `GET /api/all?bbox=south,west,north,east` - все данные

## Проверка работы

1. **Проверьте доступность сайта:**
   ```
   http://31.31.196.9
   ```

2. **Проверьте API:**
   ```
   http://31.31.196.9/api/health
   ```

3. **Проверьте логи (если нужно):**
   ```bash
   ssh -i ~/.ssh/trailspot_deploy u3288673@31.31.196.9
   tail -f /var/log/passenger.log
   ```

## Обновление приложения

Для обновления просто запустите деплой снова:

```bash
python deploy_regru.py
```

## Возможные проблемы

### SSH подключение не работает
- Проверьте что публичный ключ добавлен в `~/.ssh/authorized_keys`
- Проверьте права на файлы: `chmod 700 ~/.ssh` и `chmod 600 ~/.ssh/authorized_keys`

### Приложение не запускается
- Проверьте логи Passenger: `/var/log/passenger.log`
- Убедитесь что все зависимости установлены: `pip3 install -r requirements.txt`
- Проверьте права на файлы: `chmod +x passenger_wsgi.py`

### API не отвечает
- Проверьте что Flask приложение запущено
- Проверьте настройки CORS в `backend_simple.py`
- Проверьте доступность портов

## Преимущества REG.RU

✅ **Простота** - стандартный хостинг с Python поддержкой  
✅ **Надежность** - стабильная работа  
✅ **Панель управления** - удобное управление через веб-интерфейс  
✅ **Логи** - доступ к логам приложения  
✅ **Резервные копии** - автоматические бэкапы  
