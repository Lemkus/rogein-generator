#!/usr/bin/env python3
"""
Тест OSMnx напрямую без Flask сервера
"""

import osmnx as ox
import time
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_osmnx_direct():
    """Прямой тест OSMnx без сервера"""
    try:
        logger.info("=== ПРЯМОЙ ТЕСТ OSMnx ===")
        
        # Конфигурация OSMnx
        ox.settings.use_cache = True
        ox.settings.log_console = True
        ox.settings.timeout = 30
        ox.settings.requests_timeout = 30
        
        logger.info(f"OSMnx version: {ox.__version__}")
        logger.info(f"OSMnx settings: use_cache={ox.settings.use_cache}, timeout={ox.settings.timeout}")
        
        # Тестируем очень маленькую область
        test_bbox = (60.11, 30.23, 60.111, 30.231)  # south, west, north, east (100x100м примерно)
        logger.info(f"Тестируем загрузку графа для bbox: {test_bbox}")
        
        # Конвертируем в формат OSMnx 2.x
        bbox = tuple([test_bbox[2], test_bbox[0], test_bbox[3], test_bbox[1]])  # north, south, east, west
        logger.info(f"Конвертированный bbox: {bbox}")
        
        logger.info("🚀 Начинаем вызов ox.graph_from_bbox()...")
        start = time.time()
        
        # Попробуем простой запрос
        graph = ox.graph_from_bbox(bbox)
        
        elapsed = time.time() - start
        logger.info(f"✅ ox.graph_from_bbox() завершен за {elapsed:.2f}с")
        logger.info(f"✅ Граф загружен: {len(graph.nodes)} узлов, {len(graph.edges)} рёбер")
        
        # Тестируем конвертацию
        edges_gdf = ox.graph_to_gdfs(graph, edges=True, nodes=False)
        logger.info(f"✅ GeoDataFrame создан: {len(edges_gdf)} рёбер")
        
        # Проверяем типы дорог
        highway_types = edges_gdf['highway'].value_counts() if not edges_gdf.empty else {}
        logger.info(f"✅ Типы дорог: {dict(highway_types)}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    success = test_osmnx_direct()
    if success:
        print("✅ OSMnx тест прошел успешно!")
    else:
        print("❌ OSMnx тест не прошел!")
