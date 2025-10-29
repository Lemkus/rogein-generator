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
import json
import uuid
import urllib.parse
import base64
from datetime import datetime

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

# Путь к файлу для хранения маршрутов
ROUTES_FILE = os.path.join(PROJECT_ROOT, 'routes_storage.json')

# Кэш маршрутов в памяти
routes_cache = {}

def load_routes():
    """Загрузить маршруты из файла"""
    global routes_cache
    try:
        if os.path.exists(ROUTES_FILE):
            with open(ROUTES_FILE, 'r', encoding='utf-8') as f:
                routes_cache = json.load(f)
                logger.info(f"Загружено {len(routes_cache)} маршрутов из файла")
        else:
            routes_cache = {}
    except Exception as e:
        logger.error(f"Ошибка загрузки маршрутов: {e}")
        routes_cache = {}

def save_routes():
    """Сохранить маршруты в файл"""
    try:
        with open(ROUTES_FILE, 'w', encoding='utf-8') as f:
            json.dump(routes_cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Ошибка сохранения маршрутов: {e}")

# Загружаем маршруты при старте
load_routes()

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

@app.route('/api/save-route', methods=['POST'])
def save_route():
    """Сохранить данные маршрута и вернуть короткий ID"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Данные обязательны'}), 400
        
        # Генерируем уникальный короткий ID
        route_id = uuid.uuid4().hex[:8]  # 8 символов для короткого URL
        
        # Сохраняем данные маршрута
        routes_cache[route_id] = {
            'data': data,
            'created_at': datetime.now().isoformat(),
            'access_count': 0
        }
        
        # Сохраняем в файл
        save_routes()
        
        logger.info(f"Сохранен маршрут с ID: {route_id}")
        
        # Всегда используем production домен
        short_url = f"https://trailspot.app/r/{route_id}"
        
        return jsonify({
            'route_id': route_id,
            'url': short_url
        })
        
    except Exception as e:
        logger.error(f"Ошибка сохранения маршрута: {e}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

@app.route('/api/r/<route_id>', methods=['GET'])
def get_route(route_id):
    """Получить данные маршрута по ID"""
    try:
        if route_id not in routes_cache:
            return jsonify({'error': 'Маршрут не найден'}), 404
        
        # Увеличиваем счетчик доступа
        routes_cache[route_id]['access_count'] += 1
        save_routes()
        
        logger.info(f"Получен маршрут: {route_id}")
        
        return jsonify(routes_cache[route_id]['data'])
        
    except Exception as e:
        logger.error(f"Ошибка получения маршрута: {e}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

@app.route('/api/shorten', methods=['POST'])
def shorten_url():
    """Сократить URL через Yandex Clck.ru API или сохранить на сервере"""
    try:
        data = request.get_json()
        url = data.get('url') if data else None
        if not url:
            return jsonify({'error': 'URL обязателен'}), 400
        
        # Если URL содержит /api/save-route, это уже короткая ссылка
        if '/r/' in url:
            logger.info("URL уже содержит короткую ссылку")
            return jsonify({'short_url': url})
        
        # Извлекаем данные из URL если это старая ссылка с параметром share
        if '?share=' in url:
            # Сохраняем данные на сервере и возвращаем новую короткую ссылку
            try:
                # Извлекаем параметр share из URL
                parsed = urllib.parse.urlparse(url)
                params = urllib.parse.parse_qs(parsed.query)
                
                if 'share' in params:
                    # Декодируем данные
                    share_data = params['share'][0]
                    decoded = base64.b64decode(share_data).decode('utf-8')
                    route_data = json.loads(decoded)
                    
                    # Сохраняем на сервере
                    route_id = uuid.uuid4().hex[:8]
                    routes_cache[route_id] = {
                        'data': route_data,
                        'created_at': datetime.now().isoformat(),
                        'access_count': 0
                    }
                    save_routes()
                    
                    # Всегда используем production домен
                    short_url = f"https://trailspot.app/r/{route_id}"
                    logger.info(f"Создана короткая ссылка: {short_url}")
                    return jsonify({'short_url': short_url})
            except Exception as e:
                logger.error(f"Ошибка при создании короткой ссылки: {e}")
        
        # Старый способ через Clck.ru для других URL
        logger.info(f"Сокращаем URL длиной {len(url)} символов через clck.ru")
        try:
            response = requests.get(
                'https://clck.ru/--',
                params={'url': url},
                timeout=5
            )
            
            if response.status_code == 200:
                short_url = response.text.strip()
                if short_url.startswith('https://clck.ru/'):
                    logger.info(f"URL сокращен: {short_url}")
                    return jsonify({'short_url': short_url})
                    
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
@app.route('/r/<route_id>')
def serve_route(route_id):
    """Обслуживает короткие ссылки на маршруты - редиректит на главную страницу с параметром"""
    logger.info(f"Serving route: {route_id}")
    try:
        # Просто возвращаем index.html для фронтенда
        return send_file(os.path.join(PROJECT_ROOT, 'index.html'))
    except Exception as e:
        logger.error(f"Error serving route {route_id}: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/')
def serve_index():
    """Обслуживает главную страницу"""
    return send_file(os.path.join(PROJECT_ROOT, 'index.html'))

@app.route('/<path:filename>')
def serve_static(filename):
    """Обслуживает статические файлы"""
    # Игнорируем маршрут /r/ для статики
    if filename.startswith('r/'):
        return send_file(os.path.join(PROJECT_ROOT, 'index.html'))
    
    # Проверяем существование файла
    file_path = os.path.join(PROJECT_ROOT, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_file(file_path)
    else:
        # Если файл не найден, возвращаем главную страницу (для SPA)
        return send_file(os.path.join(PROJECT_ROOT, 'index.html'))

# Логирование при импорте модуля
if __name__ == '__main__':
    logger.info("Запуск минимального Backend сервера...")
    logger.info("Доступные endpoints:")
    logger.info("  POST /api/execute-query - проксирование запросов к Overpass API")
    logger.info("  POST /api/save-route - сохранение данных маршрута")
    logger.info("  GET /api/r/<route_id> - получение данных маршрута")
    logger.info("  POST /api/shorten - сокращение URL через Yandex Clck.ru или сохранение на сервере")
    logger.info("  GET /r/<route_id> - короткие ссылки на маршруты")
    logger.info("  GET / - главная страница")
    logger.info("  GET /<filename> - статические файлы")
    
    # Запускаем сервер только для локальной разработки
    # Passenger запускает приложение через WSGI, не через app.run()
    import os
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    )
else:
    # Когда модуль импортируется из passenger_wsgi.py
    logger.info("Backend модуль загружен для Passenger")
    # Экспортируем application для Passenger
    application = app