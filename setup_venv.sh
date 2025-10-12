#!/bin/bash
# Скрипт для настройки виртуального окружения на REG.RU

echo "=== Настройка виртуального окружения для REG.RU ==="

# Переходим в директорию проекта
cd www/trailspot.app

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

echo "=== Настройка завершена ==="
echo "Проверьте работу приложения по адресу: https://trailspot.app/"
