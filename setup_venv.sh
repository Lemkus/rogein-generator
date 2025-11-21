#!/bin/bash
# Скрипт для настройки виртуального окружения на REG.RU

echo "=== Настройка виртуального окружения для REG.RU ==="

echo "Текущая директория: $(pwd)"

# Проверяем существование виртуального окружения
if [ -d "venv" ]; then
    echo "Виртуальное окружение уже существует, пропускаем создание..."
else
    echo "Создаем виртуальное окружение с правильной версией Python..."
    /opt/python/python-3.8.6/bin/python3.8 -m venv venv
fi

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

echo "=== Настройка завершена ==="
echo "Проверьте работу приложения по адресу: https://trailspot.app/"
