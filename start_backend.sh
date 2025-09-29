#!/bin/bash

echo "========================================"
echo "  Запуск OSMnx Backend для Рогейн"
echo "========================================"
echo

echo "Проверяем установку Python..."
if ! command -v python3 &> /dev/null; then
    echo "ОШИБКА: Python3 не найден! Установите Python 3.8+"
    exit 1
fi

python3 --version

echo
echo "Проверяем установку зависимостей..."
if ! pip3 show flask &> /dev/null; then
    echo "Устанавливаем зависимости..."
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "ОШИБКА: Не удалось установить зависимости!"
        exit 1
    fi
else
    echo "Зависимости уже установлены."
fi

echo
echo "Запускаем OSMnx Backend сервер..."
echo "Сервер будет доступен по адресу: http://localhost:5000"
echo "Для остановки нажмите Ctrl+C"
echo

python3 backend_osmnx.py
