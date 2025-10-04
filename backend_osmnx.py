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
    Получает пешеходную сеть в заданной области
    """
    try:
        logger.info(f"Загружаем пешеходную сеть для области: {south},{west},{north},{east}")
        
        # Загружаем граф пешеходных маршрутов
        logger.info(f"Параметры запроса: north={north}, south={south}, east={east}, west={west}")
        
        # Загружаем все дороги, а потом фильтруем как в Overpass
        logger.info("Загружаем все дороги с network_type='all'")
        
        try:
            # OSMnx 2.x API - используем bbox как кортеж (north, south, east, west)
            bbox = (north, south, east, west)
            graph = ox.graph_from_bbox(
                bbox,
                network_type='all',
                simplify=True,
                retain_all=False,
                truncate_by_edge=True
            )
            logger.info(f"Загружен граф (all) с {len(graph.nodes)} узлами и {len(graph.edges)} рёбрами")
        except Exception as graph_error:
            logger.error(f"Ошибка загрузки графа через ox.graph_from_bbox: {graph_error}", exc_info=True)
            logger.info("Возвращаем пустой результат из-за ошибки загрузки графа")
            return []
        
        # Конвертируем в нужный формат
        logger.info("Начинаем конвертацию графа в geojson")
        paths = convert_graph_to_geojson(graph)
        
        logger.info(f"Конвертировано {len(paths)} путей")
        return paths
        
    except Exception as e:
        logger.error(f"Ошибка загрузки пешеходной сети (общая): {e}", exc_info=True)
        return []

def fetch_barriers(south: float, west: float, north: float, east: float) -> List[Dict]:
    """
    Получает барьеры (стены, заборы, водоёмы) в заданной области
    """
    try:
        logger.info(f"Загружаем барьеры для области: {south},{west},{north},{east}")
        
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
            barriers_gdf = ox.geometries_from_bbox(
                north, south, east, west,
                tags=barrier_tags
            )
        except Exception as e:
            logger.error(f"Ошибка загрузки барьеров через geometries_from_bbox: {e}")
            # Попробуем альтернативный метод
            barriers_gdf = ox.features_from_bbox(
                north, south, east, west,
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
        
        logger.info(f"Найдено {len(barriers)} барьеров")
        return barriers
        
    except Exception as e:
        logger.error(f"Ошибка загрузки барьеров: {e}")
        return []

@app.route('/api/test', methods=['GET'])
def test_osmnx():
    """Тестовый endpoint для диагностики OSMnx"""
    try:
        logger.info("=== ТЕСТ OSMnx ===")
        
        # Тестируем простой запрос к OSMnx
        test_bbox = (60.11, 30.23, 60.12, 30.26)  # south, west, north, east
        
        logger.info(f"Тестируем загрузку графа для bbox: {test_bbox}")
        
        try:
            # OSMnx 2.x API - используем bbox как кортеж (north, south, east, west)
            bbox = (test_bbox[2], test_bbox[0], test_bbox[3], test_bbox[1])  # north, south, east, west
            graph = ox.graph_from_bbox(
                bbox,
                network_type='all',
                simplify=True,
                retain_all=False,
                truncate_by_edge=True
            )
            logger.info(f"✅ Граф загружен: {len(graph.nodes)} узлов, {len(graph.edges)} рёбер")
            
            # Тестируем конвертацию
            edges_gdf = ox.graph_to_gdfs(graph, edges=True, nodes=False)
            logger.info(f"✅ GeoDataFrame создан: {len(edges_gdf)} рёбер")
            
            # Проверяем типы дорог
            highway_types = edges_gdf['highway'].value_counts() if not edges_gdf.empty else {}
            logger.info(f"✅ Типы дорог: {dict(highway_types)}")
            
            return jsonify({
                'success': True,
                'nodes': len(graph.nodes),
                'edges': len(graph.edges),
                'highway_types': dict(highway_types),
                'message': 'OSMnx работает корректно'
            })
            
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки графа: {e}", exc_info=True)
            return jsonify({
                'success': False,
                'error': str(e),
                'message': 'OSMnx не может загрузить данные'
            })
            
    except Exception as e:
        logger.error(f"❌ Общая ошибка теста: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Ошибка выполнения теста'
        })

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
        
        logger.info(f"API barriers: получен запрос с bbox={bbox}")
        
        # Парсим bbox
        south, west, north, east = parse_bbox(bbox)
        logger.info(f"API barriers: распарсен bbox south={south}, west={west}, north={north}, east={east}")
        
        # Получаем данные
        start_time = time.time()
        barriers = fetch_barriers(south, west, north, east)
        load_time = time.time() - start_time
        
        logger.info(f"API barriers: получено {len(barriers)} барьеров за {load_time:.2f}с")
        
        return jsonify({
            'success': True,
            'data': barriers,
            'count': len(barriers),
            'bbox': bbox,
            'load_time': round(load_time, 2),
            'timestamp': time.time()
        })
        
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
        port=5000,
        debug=True,
        threaded=True
    )
