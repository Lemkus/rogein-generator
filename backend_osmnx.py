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

# Конфигурация OSMnx (для версии 2.x используем settings)
ox.settings.use_cache = True
ox.settings.log_console = True
ox.settings.timeout = 30  # Таймаут для запросов к Overpass API (секунды)
ox.settings.requests_timeout = 30  # Таймаут для HTTP запросов

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
        
        # Фильтруем только пешеходные типы дорог (как в Overpass)
        pedestrian_types = {
            'path', 'footway', 'cycleway', 'track', 'service', 'bridleway',
            'unclassified', 'residential', 'living_street', 'steps', 'pedestrian'
        }
        
        # Конвертируем в формат, ожидаемый frontend
        paths = []
        filtered_count = 0
        for idx, edge in edges_gdf.iterrows():
            highway_type = edge.get('highway', 'unknown')
            
            # Фильтруем только пешеходные типы дорог
            if highway_type not in pedestrian_types:
                filtered_count += 1
                continue
            
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
                'highway': highway_type,
                'name': edge.get('name', ''),
                'surface': edge.get('surface', ''),
                'access': edge.get('access', ''),
                'osmid': str(edge.get('osmid', '')),
                'length': float(edge.get('length', 0))
            }
            
            paths.append(path_obj)
        
        logger.info(f"Отфильтровано {filtered_count} непешеходных дорог из {len(edges_gdf)}")
        
        return paths
    except Exception as e:
        logger.error(f"Ошибка конвертации графа: {e}")
        return []

def get_walking_network(south: float, west: float, north: float, east: float) -> List[Dict]:
    """
    Получает пешеходную сеть в заданной области (оптимизированная версия)
    """
    import time
    start_time = time.time()
    
    try:
        # Проверяем размер области - если слишком большая, уменьшаем
        lat_diff = north - south
        lon_diff = east - west
        
        logger.info(f"Загружаем пешеходную сеть для области: {south},{west},{north},{east}")
        logger.info(f"Размер области: {lat_diff:.4f}° x {lon_diff:.4f}°")
        
        # Если область слишком большая (>0.01° ≈ 1км), уменьшаем её
        if lat_diff > 0.01 or lon_diff > 0.01:
            logger.warning(f"Область слишком большая ({lat_diff:.4f}° x {lon_diff:.4f}°), уменьшаем до 0.01° x 0.01°")
            center_lat = (north + south) / 2
            center_lon = (east + west) / 2
            half_size = 0.005  # 0.01° / 2
            
            south = center_lat - half_size
            north = center_lat + half_size
            west = center_lon - half_size
            east = center_lon + half_size
            
            logger.info(f"Уменьшенная область: {south},{west},{north},{east}")

        try:
            # OSMnx 2.x API - используем bbox как кортеж (north, south, east, west)
            bbox = tuple([north, south, east, west])
            logger.info(f"Начинаем загрузку графа для bbox: {bbox}")
            
            graph_start = time.time()
            
            # Упрощенный запрос без дополнительных параметров для скорости
            graph = ox.graph_from_bbox(bbox)
            
            graph_time = time.time() - graph_start
            logger.info(f"Загружен граф за {graph_time:.2f}с: {len(graph.nodes)} узлов, {len(graph.edges)} рёбер")
            
            # Если граф слишком большой, возвращаем пустой результат
            if len(graph.nodes) > 10000 or len(graph.edges) > 20000:
                logger.warning(f"Граф слишком большой ({len(graph.nodes)} узлов, {len(graph.edges)} рёбер), возвращаем пустой результат")
                return []
                
        except Exception as graph_error:
            logger.error(f"Ошибка загрузки графа: {graph_error}", exc_info=True)
            return []

        # Конвертируем в нужный формат
        logger.info("Начинаем конвертацию графа в geojson")
        convert_start = time.time()
        paths = convert_graph_to_geojson(graph)
        convert_time = time.time() - convert_start
        
        total_time = time.time() - start_time
        logger.info(f"Конвертировано {len(paths)} путей за {convert_time:.2f}с. Общее время: {total_time:.2f}с")
        return paths

    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"Ошибка загрузки пешеходной сети за {total_time:.2f}с: {e}", exc_info=True)
        return []

def fetch_barriers(south: float, west: float, north: float, east: float) -> List[Dict]:
    """
    Получает барьеры (стены, заборы, водоёмы) в заданной области (оптимизированная версия)
    """
    import time
    start_time = time.time()
    
    try:
        # Проверяем размер области - если слишком большая, уменьшаем
        lat_diff = north - south
        lon_diff = east - west
        
        logger.info(f"Загружаем барьеры для области: {south},{west},{north},{east}")
        logger.info(f"Размер области: {lat_diff:.4f}° x {lon_diff:.4f}°")
        
        # Если область слишком большая (>0.01° ≈ 1км), уменьшаем её
        if lat_diff > 0.01 or lon_diff > 0.01:
            logger.warning(f"Область слишком большая ({lat_diff:.4f}° x {lon_diff:.4f}°), уменьшаем до 0.01° x 0.01°")
            center_lat = (north + south) / 2
            center_lon = (east + west) / 2
            half_size = 0.005  # 0.01° / 2
            
            south = center_lat - half_size
            north = center_lat + half_size
            west = center_lon - half_size
            east = center_lon + half_size
            
            logger.info(f"Уменьшенная область: {south},{west},{north},{east}")
        
        # Используем тот же подход, что и Overpass API для барьеров
        # ТОЛЬКО элементы с ЯВНЫМ запретом доступа + стены
        barrier_tags = {
            'access': ['no', 'private'],
            'foot': ['no'],
            'barrier': ['wall']  # Стены - обычно непроходимы по определению
        }
        
        logger.info(f"Ищем барьеры с тегами (как в Overpass): {barrier_tags}")
        
        # Загружаем барьеры
        try:
            # OSMnx 2.x API - используем bbox как кортеж (north, south, east, west)
            bbox = tuple([north, south, east, west])
            barriers_gdf = ox.geometries_from_bbox(
                bbox,
                tags=barrier_tags
            )
        except Exception as e:
            logger.error(f"Ошибка загрузки барьеров через geometries_from_bbox: {e}")
            # Попробуем альтернативный метод
            barriers_gdf = ox.features_from_bbox(
                bbox,
                tags=barrier_tags
            )

        logger.info(f"Загружено {len(barriers_gdf)} объектов барьеров")

        if barriers_gdf.empty:
            logger.info("Барьеры не найдены - пустой результат")
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
        
        total_time = time.time() - start_time
        logger.info(f"Найдено {len(barriers)} барьеров за {total_time:.2f}с")
        return barriers
        
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"Ошибка загрузки барьеров за {total_time:.2f}с: {e}", exc_info=True)
        return []

@app.route('/', methods=['GET'])
def root():
    """Корневой маршрут для диагностики"""
    return jsonify({
        'message': 'OSMnx Backend работает!',
        'service': 'osmnx-backend',
        'version': '1.0.0',
        'endpoints': [
            '/api/health',
            '/api/test',
            '/api/paths?bbox=south,west,north,east',
            '/api/barriers?bbox=south,west,north,east',
            '/api/all?bbox=south,west,north,east'
        ],
        'example': '/api/health'
    })

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
    """API для получения пешеходных маршрутов с коротким таймаутом"""
    try:
        # Получаем параметры
        bbox = request.args.get('bbox')
        if not bbox:
            return jsonify({'error': 'Параметр bbox обязателен'}), 400
        
        # Парсим bbox
        south, west, north, east = parse_bbox(bbox)
        
        # Выполняем запрос с коротким таймаутом (10 секунд)
        try:
            import threading
            import queue
            
            result_queue = queue.Queue()
            
            def worker():
                try:
                    start_time = time.time()
                    paths = get_walking_network(south, west, north, east)
                    load_time = time.time() - start_time
                    result_queue.put(('success', paths, load_time))
                except Exception as e:
                    result_queue.put(('error', str(e)))
            
            # Запускаем в отдельном потоке
            thread = threading.Thread(target=worker)
            thread.daemon = True
            thread.start()
            
            # Ждем результат максимум 5 секунд
            try:
                result_type, *result_data = result_queue.get(timeout=5)
                
                if result_type == 'success':
                    paths, load_time = result_data
                    return jsonify({
                        'success': True,
                        'data': paths,
                        'count': len(paths),
                        'bbox': bbox,
                        'load_time': round(load_time, 2),
                        'timestamp': time.time()
                    })
                else:
                    error_msg = result_data[0]
                    logger.error(f"Ошибка при загрузке пешеходных маршрутов: {error_msg}")
                    return jsonify({
                        'success': False,
                        'error': error_msg,
                        'message': 'Ошибка загрузки пешеходных маршрутов'
                    }), 500
                    
            except queue.Empty:
                logger.warning("OSMnx запрос превысил таймаут 5 секунд")
                return jsonify({
                    'success': False,
                    'error': 'Таймаут OSMnx',
                    'message': 'OSMnx не успел загрузить данные за 5 секунд'
                }), 408
                
        except Exception as e:
            logger.error(f"Ошибка при загрузке пешеходных маршрутов: {e}", exc_info=True)
            return jsonify({
                'success': False,
                'error': str(e),
                'message': 'Ошибка загрузки пешеходных маршрутов'
            }), 500
        
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
        
        logger.info(f"API barriers: получен запрос с bbox={bbox}")
        
        # Парсим bbox
        south, west, north, east = parse_bbox(bbox)
        logger.info(f"API barriers: распарсен bbox south={south}, west={west}, north={north}, east={east}")
        
        # Выполняем запрос с коротким таймаутом (5 секунд)
        try:
            import threading
            import queue
            
            result_queue = queue.Queue()
            
            def worker():
                try:
                    start_time = time.time()
                    barriers = fetch_barriers(south, west, north, east)
                    load_time = time.time() - start_time
                    result_queue.put(('success', barriers, load_time))
                except Exception as e:
                    result_queue.put(('error', str(e)))
            
            # Запускаем в отдельном потоке
            thread = threading.Thread(target=worker)
            thread.daemon = True
            thread.start()
            
            # Ждем результат максимум 5 секунд
            try:
                result_type, *result_data = result_queue.get(timeout=5)
                
                if result_type == 'success':
                    barriers, load_time = result_data
                    return jsonify({
                        'success': True,
                        'data': barriers,
                        'count': len(barriers),
                        'bbox': bbox,
                        'load_time': round(load_time, 2),
                        'timestamp': time.time()
                    })
                else:
                    error_msg = result_data[0]
                    logger.error(f"Ошибка при загрузке барьеров: {error_msg}")
                    return jsonify({
                        'success': False,
                        'error': error_msg,
                        'message': 'Ошибка загрузки барьеров'
                    }), 500
                    
            except queue.Empty:
                logger.warning("OSMnx запрос превысил таймаут 5 секунд")
                return jsonify({
                    'success': False,
                    'error': 'Таймаут OSMnx',
                    'message': 'OSMnx не успел загрузить данные за 5 секунд'
                }), 408
                
        except Exception as e:
            logger.error(f"Ошибка при загрузке барьеров: {e}", exc_info=True)
            return jsonify({
                'success': False,
                'error': str(e),
                'message': 'Ошибка загрузки барьеров'
            }), 500
        
    except ValueError as e:
        logger.error(f"API barriers: ошибка валидации bbox: {e}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"API barriers: внутренняя ошибка: {e}", exc_info=True)
        return jsonify({'error': f'Внутренняя ошибка сервера: {str(e)}'}), 500

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
        barriers = fetch_barriers(south, west, north, east)
        
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
        port=6004,
        debug=True,
        threaded=True
    )
