#!/bin/bash
# Скрипт для настройки виртуального окружения на REG.RU

echo "=== Настройка виртуального окружения для REG.RU ==="

echo "Текущая директория: $(pwd)"
echo "Содержимое директории:"
ls -la

# Создаем виртуальное окружение с правильной версией Python
echo "Создаем виртуальное окружение..."
/opt/python/python-3.8.6/bin/python3.8 -m venv venv

# Активируем виртуальное окружение
echo "Активируем виртуальное окружение..."
source venv/bin/activate

# Обновляем pip
echo "Обновляем pip..."
pip install --upgrade pip

# Устанавливаем зависимости
echo "Устанавливаем зависимости..."
pip install -r requirements.txt

# Проверяем установленные пакеты
echo "Установленные пакеты:"
pip list

# Проверяем права на файлы
echo "Устанавливаем права на файлы..."
chmod 644 passenger_wsgi.py
chmod 644 backend_simple.py
chmod 644 requirements.txt

# Перезапускаем Passenger
echo "Перезапускаем Passenger..."
touch passenger_wsgi.py

# Останавливаем старый backend если запущен
echo "Останавливаем старый backend_simple..."
pkill -f 'python3 backend_simple.py' 2>/dev/null || echo 'Старый процесс не найден'

# Запускаем backend_simple в фоне на порту 5000
echo "Запускаем backend_simple.py в фоне..."
nohup python3 backend_simple.py > flask.log 2>&1 &

# Ждем запуска
sleep 2

# Проверяем что backend запустился
if pgrep -f 'python3 backend_simple.py' > /dev/null; then
    echo "✅ Backend успешно запущен"
else
    echo "⚠️ Backend не запустился, проверьте логи"
fi

echo "=== Настройка завершена ==="
echo "Проверьте работу приложения по адресу: https://trailspot.app/"
