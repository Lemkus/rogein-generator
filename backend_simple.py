#!/usr/bin/env python3
"""
Упрощенный Backend для быстрой загрузки данных OpenStreetMap
Использует прямые запросы к Overpass API без сложных зависимостей
"""

from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import requests
import json
import time
import logging
import os
from typing import Dict, List, Tuple, Optional

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

def parse_bbox(bbox_string: str) -> Tuple[float, float, float, float]:
    """
    Парсит строку bbox в формате 'south,west,north,east'
    Возвращает кортеж (south, west, north, east)
    """
    try:
        parts = bbox_string.split(',')
        if len(parts) != 4:
            raise ValueError("bbox должен содержать 4 значения")
        
        south, west, north, east = map(float, parts)
        
        # Проверяем корректность координат
        if not (-90 <= south <= 90) or not (-90 <= north <= 90):
            raise ValueError("Широта должна быть между -90 и 90")
        if not (-180 <= west <= 180) or not (-180 <= east <= 180):
            raise ValueError("Долгота должна быть между -180 и 180")
        if south >= north:
            raise ValueError("south должна быть меньше north")
        if west >= east:
            raise ValueError("west должна быть меньше east")
            
        return south, west, north, east
    except Exception as e:
        logger.error(f"Ошибка парсинга bbox '{bbox_string}': {e}")
        raise ValueError(f"Неверный формат bbox: {e}")

def execute_overpass_query(query: str) -> List[Dict]:
    """
    Выполняет запрос к Overpass API
    """
    try:
        logger.info(f"Выполняем запрос к Overpass API...")
        
        response = requests.post(
            OVERPASS_URL,
            data=query,
            headers={'Content-Type': 'text/plain'},
            timeout=TIMEOUT
        )
        
        if response.status_code != 200:
            raise Exception(f"HTTP {response.status_code}: {response.text}")
        
        data = response.json()
        
        if 'elements' not in data:
            logger.warning("Overpass API вернул неожиданный формат данных")
            return []
        
        logger.info(f"Получено {len(data['elements'])} элементов")
        return data['elements']
        
    except Exception as e:
        logger.error(f"Ошибка запроса к Overpass API: {e}")
        raise

def get_walking_network(south: float, west: float, north: float, east: float) -> List[Dict]:
    """
    Получает пешеходную сеть в заданной области
    """
    try:
        logger.info(f"Загружаем пешеходную сеть для области: {south},{west},{north},{east}")
        
        # Расширенный запрос для пешеходных маршрутов (как в клиентском коде)
        query = f"""[out:json][timeout:{TIMEOUT}];
        (
          way["highway"="path"]({south},{west},{north},{east});
          way["highway"="footway"]({south},{west},{north},{east});
          way["highway"="cycleway"]({south},{west},{north},{east});
          way["highway"="track"]({south},{west},{north},{east});
          way["highway"="service"]({south},{west},{north},{east});
          way["highway"="bridleway"]({south},{west},{north},{east});
          way["highway"="unclassified"]({south},{west},{north},{east});
          way["highway"="residential"]({south},{west},{north},{east});
          way["highway"="living_street"]({south},{west},{north},{east});
          way["highway"="steps"]({south},{west},{north},{east});
          way["highway"="pedestrian"]({south},{west},{north},{east});
        );
        out geom;"""
        
        elements = execute_overpass_query(query)
        
        # Конвертируем в нужный формат
        paths = []
        highway_counts = {}  # Счетчик типов дорог для отладки
        
        for element in elements:
            if element.get('type') == 'way' and 'geometry' in element:
                geometry = []
                for coord in element['geometry']:
                    if 'lat' in coord and 'lon' in coord:
                        geometry.append([coord['lat'], coord['lon']])
                
                if len(geometry) >= 2:  # Минимум 2 точки для пути
                    highway_type = element.get('tags', {}).get('highway', 'unknown')
                    highway_counts[highway_type] = highway_counts.get(highway_type, 0) + 1
                    
                    path_obj = {
                        'geometry': geometry,
                        'highway': highway_type,
                        'name': element.get('tags', {}).get('name', ''),
                        'surface': element.get('tags', {}).get('surface', ''),
                        'access': element.get('tags', {}).get('access', ''),
                        'osmid': str(element.get('id', '')),
                        'length': 0  # Простая версия не вычисляет длину
                    }
                    paths.append(path_obj)
        
        # Логируем статистику типов дорог
        logger.info(f"Конвертировано {len(paths)} путей")
        logger.info(f"Распределение типов дорог: {highway_counts}")
        return paths
        
    except Exception as e:
        logger.error(f"Ошибка загрузки пешеходной сети: {e}")
        return []

def get_barriers_data(south: float, west: float, north: float, east: float) -> List[Dict]:
    """
    Получает барьеры в заданной области
    """
    try:
        logger.info(f"Загружаем барьеры для области: {south},{west},{north},{east}")
        
        query = f"""[out:json][timeout:{TIMEOUT}];
        (
          way["barrier"="wall"]({south},{west},{north},{east});
          way["natural"="cliff"]({south},{west},{north},{east});
        );
        out geom;"""
        
        elements = execute_overpass_query(query)
        
        # Конвертируем в нужный формат
        barriers = []
        for element in elements:
            if element.get('type') == 'way' and 'geometry' in element:
                geometry = []
                for coord in element['geometry']:
                    if 'lat' in coord and 'lon' in coord:
                        geometry.append([coord['lat'], coord['lon']])
                
                if len(geometry) >= 2:
                    barrier_obj = {
                        'geometry': geometry,
                        'type': 'barrier',
                        'barrier_type': element.get('tags', {}).get('barrier', ''),
                        'natural': element.get('tags', {}).get('natural', ''),
                        'waterway': element.get('tags', {}).get('waterway', ''),
                        'name': element.get('tags', {}).get('name', ''),
                        'osmid': str(element.get('id', ''))
                    }
                    barriers.append(barrier_obj)
        
        logger.info(f"Конвертировано {len(barriers)} барьеров")
        return barriers
        
    except Exception as e:
        logger.error(f"Ошибка загрузки барьеров: {e}")
        return []

def get_closed_areas_data(south: float, west: float, north: float, east: float) -> List[Dict]:
    """
    Получает закрытые зоны в заданной области
    """
    try:
        logger.info(f"Загружаем закрытые зоны для области: {south},{west},{north},{east}")
        
        query = f"""[out:json][timeout:{TIMEOUT}];
        (
          way["military"="yes"]({south},{west},{north},{east});
          way["access"="no"]({south},{west},{north},{east});
          way["access"="private"]({south},{west},{north},{east});
          way["access"="restricted"]({south},{west},{north},{east});
        );
        out geom;"""
        
        elements = execute_overpass_query(query)
        
        # Конвертируем в нужный формат
        closed_areas = []
        for element in elements:
            if element.get('type') == 'way' and 'geometry' in element:
                geometry = []
                for coord in element['geometry']:
                    if 'lat' in coord and 'lon' in coord:
                        geometry.append([coord['lat'], coord['lon']])
                
                if len(geometry) >= 2:
                    area_obj = {
                        'geometry': geometry,
                        'type': 'closed_area',
                        'military': element.get('tags', {}).get('military', ''),
                        'access': element.get('tags', {}).get('access', ''),
                        'name': element.get('tags', {}).get('name', ''),
                        'osmid': str(element.get('id', ''))
                    }
                    closed_areas.append(area_obj)
        
        logger.info(f"Конвертировано {len(closed_areas)} закрытых зон")
        return closed_areas
        
    except Exception as e:
        logger.error(f"Ошибка загрузки закрытых зон: {e}")
        return []

def get_water_areas_data(south: float, west: float, north: float, east: float) -> List[Dict]:
    """
    Водоёмы больше не загружаем - они не нужны для навигации по тропам
    """
    logger.info("Водоёмы не загружаются - не нужны для навигации по тропам")
    return []

@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка состояния сервера"""
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'backend_type': 'simple_overpass'
    })

@app.route('/api/paths', methods=['GET'])
def get_paths():
    """API для получения пешеходных маршрутов"""
    try:
        # Получаем параметры
        bbox = request.args.get('bbox')
        if not bbox:
            return jsonify({'error': 'Параметр bbox обязателен'}), 400
        
        # Парсим bbox
        south, west, north, east = parse_bbox(bbox)
        
        # Получаем данные
        start_time = time.time()
        paths = get_walking_network(south, west, north, east)
        load_time = time.time() - start_time
        
        return jsonify({
            'success': True,
            'data': paths,
            'count': len(paths),
            'bbox': bbox,
            'load_time': round(load_time, 2),
            'timestamp': time.time()
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Ошибка API paths: {e}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

@app.route('/api/barriers', methods=['GET'])
def get_barriers():
    """API для получения барьеров"""
    try:
        # Получаем параметры
        bbox = request.args.get('bbox')
        if not bbox:
            return jsonify({'error': 'Параметр bbox обязателен'}), 400
        
        # Парсим bbox
        south, west, north, east = parse_bbox(bbox)
        
        # Получаем данные
        start_time = time.time()
        barriers = get_barriers_data(south, west, north, east)
        load_time = time.time() - start_time
        
        return jsonify({
            'success': True,
            'data': barriers,
            'count': len(barriers),
            'bbox': bbox,
            'load_time': round(load_time, 2),
            'timestamp': time.time()
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Ошибка API barriers: {e}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

@app.route('/api/all', methods=['GET'])
def get_all():
    """API для получения всех данных (тропы + барьеры)"""
    try:
        # Получаем параметры
        bbox = request.args.get('bbox')
        if not bbox:
            return jsonify({'error': 'Параметр bbox обязателен'}), 400
        
        # Парсим bbox
        south, west, north, east = parse_bbox(bbox)
        
        # Получаем все данные
        start_time = time.time()
        
        paths = get_walking_network(south, west, north, east)
        barriers = get_barriers_data(south, west, north, east)
        
        load_time = time.time() - start_time
        
        return jsonify({
            'success': True,
            'paths': paths,
            'barriers': barriers,
            'paths_count': len(paths),
            'barriers_count': len(barriers),
            'bbox': bbox,
            'load_time': round(load_time, 2),
            'timestamp': time.time()
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Ошибка API all: {e}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

@app.route('/api/closed-areas', methods=['GET'])
def get_closed_areas():
    """API для получения закрытых зон"""
    try:
        # Получаем параметры
        bbox = request.args.get('bbox')
        if not bbox:
            return jsonify({'error': 'Параметр bbox обязателен'}), 400
        
        # Парсим bbox
        south, west, north, east = parse_bbox(bbox)
        
        # Получаем данные
        start_time = time.time()
        closed_areas = get_closed_areas_data(south, west, north, east)
        load_time = time.time() - start_time
        
        return jsonify({
            'success': True,
            'data': closed_areas,
            'count': len(closed_areas),
            'bbox': bbox,
            'load_time': round(load_time, 2),
            'timestamp': time.time()
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Ошибка API closed-areas: {e}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

@app.route('/api/water-areas', methods=['GET'])
def get_water_areas():
    """API для получения водоёмов"""
    try:
        # Получаем параметры
        bbox = request.args.get('bbox')
        if not bbox:
            return jsonify({'error': 'Параметр bbox обязателен'}), 400
        
        # Парсим bbox
        south, west, north, east = parse_bbox(bbox)
        
        # Получаем данные
        start_time = time.time()
        water_areas = get_water_areas_data(south, west, north, east)
        load_time = time.time() - start_time
        
        return jsonify({
            'success': True,
            'data': water_areas,
            'count': len(water_areas),
            'bbox': bbox,
            'load_time': round(load_time, 2),
            'timestamp': time.time()
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Ошибка API water-areas: {e}")
        return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

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
    logger.info("Запуск Simple Backend сервера...")
    logger.info("Доступные endpoints:")
    logger.info("  GET /api/health - проверка состояния")
    logger.info("  GET /api/paths?bbox=south,west,north,east - пешеходные маршруты")
    logger.info("  GET /api/barriers?bbox=south,west,north,east - барьеры")
    logger.info("  GET /api/closed-areas?bbox=south,west,north,east - закрытые зоны")
    logger.info("  GET /api/water-areas?bbox=south,west,north,east - водоёмы")
    logger.info("  GET /api/all?bbox=south,west,north,east - все данные")
    
    # Запускаем сервер
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )