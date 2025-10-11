#!/usr/bin/env python3
"""
WSGI файл для запуска Flask приложения на REG.RU Passenger
Исправленная версия с правильной активацией виртуального окружения
"""

import sys
import os

# Добавляем путь к виртуальному окружению
project_path = os.path.dirname(os.path.abspath(__file__))
venv_path = os.path.join(project_path, 'venv')

# Добавляем путь к библиотекам виртуального окружения
if os.path.exists(venv_path):
    venv_lib_path = os.path.join(venv_path, 'lib', 'python3.*', 'site-packages')
    import glob
    site_packages = glob.glob(venv_lib_path)
    if site_packages:
        sys.path.insert(0, site_packages[0])
    
    # Добавляем путь к проекту
    if project_path not in sys.path:
        sys.path.insert(0, project_path)

# Импортируем Flask приложение
try:
    from backend_simple import app
    application = app
    print("Flask приложение успешно импортировано")
except Exception as e:
    print(f"Ошибка импорта Flask приложения: {e}")
    # Создаем простое приложение для отладки
    from flask import Flask
    app = Flask(__name__)
    
    @app.route('/')
    def hello():
        return f'<h1>Ошибка импорта: {e}</h1><p>Проверьте виртуальное окружение и зависимости</p>'
    
    application = app

if __name__ == "__main__":
    # Для локального тестирования
    app.run(host='0.0.0.0', port=5000, debug=True)