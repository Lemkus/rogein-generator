@echo off
echo Запуск бэкенда Рогейн...
cd /d "%~dp0"

echo Проверка Python...
python --version
if errorlevel 1 (
    echo ОШИБКА: Python не найден!
    pause
    exit /b 1
)

echo Проверка зависимостей...
python -c "import uvicorn, fastapi; print('Зависимости OK')" 2>nul
if errorlevel 1 (
    echo Установка зависимостей...
    python -m pip install --no-binary=:all: uvicorn==0.24.0 fastapi==0.104.1 pydantic==2.5.0
    if errorlevel 1 (
        echo ОШИБКА: Не удалось установить зависимости!
        pause
        exit /b 1
    )
)

echo Запуск сервера на http://127.0.0.1:8001
echo Для остановки нажмите Ctrl+C
echo.
python -m uvicorn app.simple_main:app --host 127.0.0.1 --port 8001 --reload

pause
