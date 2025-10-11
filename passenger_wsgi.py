#!/usr/bin/env python3
"""
WSGI файл для запуска Flask приложения на REG.RU Passenger
"""

import sys
import os

# Добавляем путь к проекту
project_path = os.path.dirname(os.path.abspath(__file__))
if project_path not in sys.path:
    sys.path.insert(0, project_path)

# Импортируем Flask приложение
from backend_simple import app

# Passenger ожидает переменную application
application = app

if __name__ == "__main__":
    # Для локального тестирования
    app.run(host='0.0.0.0', port=5000, debug=True)
