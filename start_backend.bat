@echo off
echo ========================================
echo   Запуск OSMnx Backend для Рогейн
echo ========================================
echo.

echo Проверяем установку Python...
python --version
if errorlevel 1 (
    echo ОШИБКА: Python не найден! Установите Python 3.8+ с https://python.org
    pause
    exit /b 1
)

echo.
echo Проверяем установку зависимостей...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo Устанавливаем зависимости...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ОШИБКА: Не удалось установить зависимости!
        pause
        exit /b 1
    )
) else (
    echo Зависимости уже установлены.
)

echo.
echo Запускаем Simple Backend сервер...
echo Сервер будет доступен по адресу: http://localhost:5000
echo Для остановки нажмите Ctrl+C
echo.

python backend_simple.py

pause
