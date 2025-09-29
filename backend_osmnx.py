#!/usr/bin/env python3
"""
OSMnx Backend для быстрой загрузки данных OpenStreetMap
Предоставляет API для получения троп, барьеров и других геоданных
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import osmnx as ox
import geopandas as gpd
import json
import time
import logging
from typing import Dict, List, Tuple, Optional

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Включаем CORS для работы с frontend

# Конфигурация OSMnx
ox.config(use_cache=True, log_console=True)

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

def convert_graph_to_geojson(graph) -> List[Dict]:
    """
    Конвертирует OSMnx граф в список объектов, совместимых с нашим frontend
    """
    try:
        # Получаем граф как GeoDataFrame
        edges_gdf = ox.graph_to_gdfs(graph, edges=True, nodes=False)
        
        if edges_gdf.empty:
            return []
        
        # Конвертируем в формат, ожидаемый frontend
        paths = []
        for idx, edge in edges_gdf.iterrows():
            # Получаем геометрию как список координат
            if hasattr(edge.geometry, 'coords'):
                coords = list(edge.geometry.coords)
                # Конвертируем (lon, lat) в (lat, lon) для совместимости
                geometry = [[coord[1], coord[0]] for coord in coords]
            else:
                continue
            
            # Создаем объект пути
            path_obj = {
                'geometry': geometry,
                'highway': edge.get('highway', 'unknown'),
                'name': edge.get('name', ''),
                'surface': edge.get('surface', ''),
                'access': edge.get('access', ''),
                'osmid': str(edge.get('osmid', '')),
                'length': float(edge.get('length', 0))
            }
            
            paths.append(path_obj)
        
        return paths
    except Exception as e:
        logger.error(f"Ошибка конвертации графа: {e}")
        return []

def get_walking_network(south: float, west: float, north: float, east: float) -> List[Dict]:
    """
    Получает пешеходную сеть в заданной области
    """
    try:
        logger.info(f"Загружаем пешеходную сеть для области: {south},{west},{north},{east}")
        
        # Загружаем граф пешеходных маршрутов
        graph = ox.graph_from_bbox(
            north, south, east, west,
            network_type='walk',  # Только пешеходные маршруты
            simplify=True,        # Упрощаем граф
            retain_all=False,     # Удаляем изолированные узлы
            truncate_by_edge=True # Обрезаем по границам
        )
        
        logger.info(f"Загружен граф с {len(graph.nodes)} узлами и {len(graph.edges)} рёбрами")
        
        # Конвертируем в нужный формат
        paths = convert_graph_to_geojson(graph)
        
        logger.info(f"Конвертировано {len(paths)} путей")
        return paths
        
    except Exception as e:
        logger.error(f"Ошибка загрузки пешеходной сети: {e}")
        return []

def get_barriers(south: float, west: float, north: float, east: float) -> List[Dict]:
    """
    Получает барьеры (стены, заборы, водоёмы) в заданной области
    """
    try:
        logger.info(f"Загружаем барьеры для области: {south},{west},{north},{east}")
        
        # Определяем теги для барьеров
        barrier_tags = {
            'barrier': ['wall', 'fence', 'hedge', 'retaining_wall'],
            'natural': ['water', 'cliff', 'rock'],
            'waterway': ['river', 'stream', 'canal', 'ditch'],
            'landuse': ['military', 'industrial']
        }
        
        # Загружаем барьеры
        barriers_gdf = ox.geometries_from_bbox(
            north, south, east, west,
            tags=barrier_tags,
            geom_type='polygon'  # Только полигоны для барьеров
        )
        
        if barriers_gdf.empty:
            logger.info("Барьеры не найдены")
            return []
        
        # Конвертируем в нужный формат
        barriers = []
        for idx, barrier in barriers_gdf.iterrows():
            try:
                # Получаем геометрию
                if hasattr(barrier.geometry, 'exterior'):
                    # Полигон
                    coords = list(barrier.geometry.exterior.coords)
                    geometry = [[coord[1], coord[0]] for coord in coords]  # lat, lon
                elif hasattr(barrier.geometry, 'coords'):
                    # Линия
                    coords = list(barrier.geometry.coords)
                    geometry = [[coord[1], coord[0]] for coord in coords]  # lat, lon
                else:
                    continue
                
                # Создаем объект барьера
                barrier_obj = {
                    'geometry': geometry,
                    'type': 'barrier',
                    'barrier_type': barrier.get('barrier', ''),
                    'natural': barrier.get('natural', ''),
                    'waterway': barrier.get('waterway', ''),
                    'name': barrier.get('name', ''),
                    'osmid': str(barrier.get('osmid', ''))
                }
                
                barriers.append(barrier_obj)
                
            except Exception as e:
                logger.warning(f"Ошибка обработки барьера {idx}: {e}")
                continue
        
        logger.info(f"Найдено {len(barriers)} барьеров")
        return barriers
        
    except Exception as e:
        logger.error(f"Ошибка загрузки барьеров: {e}")
        return []

@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка состояния сервера"""
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'osmnx_version': ox.__version__
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
        barriers = get_barriers(south, west, north, east)
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
        barriers = get_barriers(south, west, north, east)
        
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

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'API endpoint не найден'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Внутренняя ошибка сервера'}), 500

if __name__ == '__main__':
    logger.info("Запуск OSMnx Backend сервера...")
    logger.info("Доступные endpoints:")
    logger.info("  GET /api/health - проверка состояния")
    logger.info("  GET /api/paths?bbox=south,west,north,east - пешеходные маршруты")
    logger.info("  GET /api/barriers?bbox=south,west,north,east - барьеры")
    logger.info("  GET /api/all?bbox=south,west,north,east - все данные")
    
    # Запускаем сервер
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )
