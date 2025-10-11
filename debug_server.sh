#!/bin/bash
# Скрипт диагностики проблем с Flask приложением на REG.RU

echo "=== Диагностика Flask приложения на REG.RU ==="

# Переходим в директорию проекта
cd www/trailspot.app

echo "1. Проверяем текущую директорию:"
pwd
echo ""

echo "2. Проверяем содержимое директории:"
ls -la
echo ""

echo "3. Проверяем существование ключевых файлов:"
echo "passenger_wsgi.py: $(test -f passenger_wsgi.py && echo 'существует' || echo 'НЕ НАЙДЕН')"
echo "backend_simple.py: $(test -f backend_simple.py && echo 'существует' || echo 'НЕ НАЙДЕН')"
echo "requirements.txt: $(test -f requirements.txt && echo 'существует' || echo 'НЕ НАЙДЕН')"
echo "venv/: $(test -d venv && echo 'существует' || echo 'НЕ НАЙДЕН')"
echo ""

echo "4. Проверяем права на файлы:"
ls -la passenger_wsgi.py backend_simple.py requirements.txt 2>/dev/null || echo "Файлы не найдены"
echo ""

echo "5. Проверяем Python версию:"
python3 --version
echo ""

echo "6. Проверяем виртуальное окружение:"
if [ -d "venv" ]; then
    echo "Виртуальное окружение найдено"
    echo "Активируем venv..."
    source venv/bin/activate
    echo "Python в venv: $(which python)"
    echo "Установленные пакеты:"
    pip list | grep -E "(flask|requests)" || echo "Flask/requests не установлены"
else
    echo "Виртуальное окружение НЕ НАЙДЕНО"
fi
echo ""

echo "7. Проверяем синтаксис Python файлов:"
if [ -f "backend_simple.py" ]; then
    echo "Проверяем backend_simple.py..."
    python3 -m py_compile backend_simple.py && echo "Синтаксис OK" || echo "ОШИБКА СИНТАКСИСА"
fi

if [ -f "passenger_wsgi.py" ]; then
    echo "Проверяем passenger_wsgi.py..."
    python3 -m py_compile passenger_wsgi.py && echo "Синтаксис OK" || echo "ОШИБКА СИНТАКСИСА"
fi
echo ""

echo "8. Проверяем логи Passenger:"
echo "Последние 20 строк лога Passenger:"
tail -20 /var/log/passenger.log 2>/dev/null || echo "Лог Passenger недоступен"
echo ""

echo "9. Проверяем логи Apache:"
echo "Последние 20 строк лога ошибок Apache:"
tail -20 /var/log/apache2/error.log 2>/dev/null || echo "Лог Apache недоступен"
echo ""

echo "10. Проверяем процессы Python:"
ps aux | grep python | grep -v grep || echo "Процессы Python не найдены"
echo ""

echo "=== Диагностика завершена ==="
echo ""
echo "Если виртуальное окружение не найдено, выполните:"
echo "  python3 -m venv venv"
echo "  source venv/bin/activate"
echo "  pip install -r requirements.txt"
echo "  touch passenger_wsgi.py"
