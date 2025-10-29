#!/usr/bin/env python3
"""
Минимальный Backend для проксирования запросов к Overpass API
Согласно принципу DRY - только проксирование, без дублирования логики
"""

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import requests
import time
import logging
import os

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Включаем CORS для работы с frontend

# Конфигурация Overpass API
OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
TIMEOUT = 60

# Получаем путь к корневой директории проекта
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
logger.info(f"Корневая директория проекта: {PROJECT_ROOT}")

@app.route('/api/execute-query', methods=['POST'])
def execute_query():
    """API для выполнения Overpass запроса от клиента (прокси к Overpass API)"""
    try:
        # Получаем готовый запрос от клиента
        query = request.get_data(as_text=True)
        if not query:
            return jsonify({'error': 'Пустой запрос'}), 400

        logger.info(f"Проксируем Overpass запрос длиной {len(query)} символов")

        # Просто проксируем запрос к Overpass API и возвращаем результат
        start_time = time.time()
        response = requests.post(
            OVERPASS_URL,
            data=query,
            headers={'Content-Type': 'text/plain'},
            timeout=TIMEOUT
        )
        load_time = time.time() - start_time
        
        if response.status_code != 200:
            logger.error(f"Overpass API вернул ошибку: {response.status_code}")
            return jsonify({'error': f'Overpass API error: {response.status_code}'}), 500
        
        # Возвращаем данные как есть от Overpass API
        data = response.json()
        logger.info(f"Получено {len(data.get('elements', []))} элементов за {load_time:.2f}с")
        
        return jsonify({
            'success': True,
            'data': data,
            'load_time': round(load_time, 2),
            'timestamp': time.time()
        })
        
    except Exception as e:
        logger.error(f"Ошибка execute-query: {e}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

@app.route('/api/shorten', methods=['POST'])
def shorten_url():
    """Сократить URL через Yandex Clck.ru API"""
    try:
        data = request.get_json()
        url = data.get('url') if data else None
        if not url:
            return jsonify({'error': 'URL обязателен'}), 400
        
        logger.info(f"Сокращаем URL длиной {len(url)} символов через clck.ru")
        
        # Используем Yandex Clck.ru API
        try:
            response = requests.get(
                'https://clck.ru/--',
                params={'url': url},
                timeout=5
            )
            
            if response.status_code == 200:
                short_url = response.text.strip()
                # Проверяем, что получили валидный короткий URL
                if short_url.startswith('https://clck.ru/'):
                    logger.info(f"URL сокращен: {short_url}")
                    return jsonify({'short_url': short_url})
                else:
                    logger.warning(f"Неожиданный ответ от clck.ru: {short_url}")
            else:
                logger.warning(f"clck.ru вернул статус: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Ошибка при запросе к clck.ru: {e}")
        
        # Если не удалось сократить, возвращаем исходный URL
        logger.warning("Не удалось сократить URL, возвращаем исходный")
        return jsonify({'short_url': url})
        
    except Exception as e:
        logger.error(f"Ошибка shorten_url: {e}")
        data = request.get_json() if request.is_json else {}
        url = data.get('url', '')
        return jsonify({'short_url': url})

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'API endpoint не найден'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

# Маршруты для статических файлов (должны быть в конце)
@app.route('/')
def serve_index():
    """Обслуживает главную страницу"""
    return send_file(os.path.join(PROJECT_ROOT, 'index.html'))

@app.route('/<path:filename>')
def serve_static(filename):
    """Обслуживает статические файлы"""
    # Проверяем существование файла
    file_path = os.path.join(PROJECT_ROOT, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_file(file_path)
    else:
        # Если файл не найден, возвращаем главную страницу (для SPA)
        return send_file(os.path.join(PROJECT_ROOT, 'index.html'))

if __name__ == '__main__':
    logger.info("Запуск минимального Backend сервера...")
    logger.info("Доступные endpoints:")
    logger.info("  POST /api/execute-query - проксирование запросов к Overpass API")
    logger.info("  POST /api/shorten - сокращение URL через Yandex Clck.ru")
    logger.info("  GET / - главная страница")
    logger.info("  GET /<filename> - статические файлы")
    
    # Запускаем сервер
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )