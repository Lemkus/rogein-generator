/**
 * Модуль для работы с картой Leaflet
 * Управляет инициализацией карты, маркерами и визуализацией
 */

import { extractPolygons } from './utils.js';

// Переменные карты
export let map;
export let drawnItems;
export let drawControl;
export let selectedBounds = null;
export let startPoint = null;
export let startMarker = null;
export let pointMarkers = [];
export let closedAreas = [];
export let closedAreaLayers = [];
export let waterAreas = [];
export let waterAreaLayers = [];
export let barriers = [];
export let barrierLayers = [];
export let routeLine = null;
export let failedAttemptMarkers = [];
export let graphDebugLayers = [];
export let excludedPathSegments = [];

// Инициализация карты
export function initMap() {
  // Проверяем доступность Leaflet
  if (typeof L === 'undefined') {
    console.error('Leaflet не загружен! Убедитесь, что библиотека Leaflet подключена до загрузки модулей.');
    return false;
  }

  try {
    // Проверяем, существует ли уже карта
    const existingMap = document.querySelector('#map');
    if (existingMap && existingMap._leaflet_id) {
      console.log('Карта уже существует, пропускаем инициализацию');
      return true; // Карта уже инициализирована, ничего не делаем
    }

    // Создаем новую карту
    map = L.map('map').setView([60.1105, 30.3705], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Добавляем Leaflet Draw
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
      draw: {
        polygon: false,
        marker: true,  // Разрешаем маркеры для точки старта
        circle: false,
        circlemarker: false,
        polyline: false,
        rectangle: true
      },
      edit: {
        featureGroup: drawnItems
      }
    });
    map.addControl(drawControl);

    // Обработчик создания объектов на карте
    map.on(L.Draw.Event.CREATED, handleDrawCreated);
    
    console.log('Карта инициализирована успешно');
    return true;
  } catch (error) {
    console.error('Ошибка инициализации карты:', error);
    return false;
  }
}

// Обработчик создания объектов на карте
function handleDrawCreated(event) {
  const layer = event.layer;
  
  if (layer instanceof L.Rectangle) {
    // Очищаем предыдущий прямоугольник
    drawnItems.getLayers().forEach(l => {
      if (l instanceof L.Rectangle) {
        drawnItems.removeLayer(l);
      }
    });
    drawnItems.addLayer(layer);
    
    // Обновляем selectedBounds с правильной структурой
    const bounds = layer.getBounds();
    selectedBounds = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast()
    };
    console.log('Выбрана область:', selectedBounds);
  } else if (layer instanceof L.Marker) {
    // Обработка маркера старта
    if (startMarker) {
      map.removeLayer(startMarker);
    }
    startPoint = layer.getLatLng();
    startMarker = L.marker([startPoint.lat, startPoint.lng], {
      icon: L.icon({
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkY0NDQ0IiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(map)
    .bindPopup('Точка старта')
    .openPopup();
    console.log('Точка старта установлена:', startPoint);
  }
}

// Отображение закрытых зон на карте
export function showClosedAreasOnMap(areas) {
  // Удаляем старые полигоны
  closedAreaLayers.forEach(l => map.removeLayer(l));
  closedAreaLayers = [];

  // Используем extractPolygons для получения всех полигонов (включая 2-точечные)
  const polygons = extractPolygons(areas);
  
  polygons.forEach((polygon, index) => {
    console.log(`🔍 Отображение полигона ${index + 1} с ${polygon.length} точками`);
    
    // Валидация координат полигона
    const validCoords = polygon.filter(coord => 
      Array.isArray(coord) && coord.length === 2 && 
      typeof coord[0] === 'number' && typeof coord[1] === 'number' &&
      !isNaN(coord[0]) && !isNaN(coord[1])
    );
    
    if (validCoords.length < 3) {
      console.warn(`🔍 Отображение полигона ${index + 1}: пропускаем полигон с недостаточным количеством валидных координат: ${validCoords.length}`);
      return;
    }
    
    try {
      console.log(`🔍 Создаем полигон с координатами:`, validCoords.slice(0, 3)); // первые 3 точки
      const polygonLayer = L.polygon(validCoords, {
        color: 'red', 
        fillColor: 'red',
        fillOpacity: 0.3,
        weight: 2
      }).addTo(map);
      closedAreaLayers.push(polygonLayer);
      console.log(`🔍 Полигон ${index + 1} успешно добавлен на карту`);
    } catch (error) {
      console.error(`🔍 Ошибка создания полигона ${index + 1}:`, error);
      console.log(`🔍 Проблемные координаты:`, validCoords);
    }
  });

  closedAreas = areas;
  console.log(`🔍 Отображено ${polygons.length} запретных зон на карте`);
}

// Отображение водоёмов на карте
export function showWaterAreasOnMap(areas) {
  // Удаляем старые полигоны
  waterAreaLayers.forEach(l => map.removeLayer(l));
  waterAreaLayers = [];

  // Используем extractPolygons для получения всех полигонов (включая 2-точечные)
  const polygons = extractPolygons(areas);
  
  polygons.forEach((polygon, index) => {
    console.log(`🔍 Отображение водоёма ${index + 1} с ${polygon.length} точками`);
    const polygonLayer = L.polygon(polygon, {
      color: 'blue', 
      fillColor: 'blue',
      fillOpacity: 0.3,
      weight: 2
    }).addTo(map);
    waterAreaLayers.push(polygonLayer);
  });

  waterAreas = areas;
  console.log(`🔍 Отображено ${polygons.length} водоёмов на карте`);
}

// Отображение барьеров на карте
export function showBarriersOnMap(barrierData) {
  // Удаляем старые слои
  barrierLayers.forEach(l => map.removeLayer(l));
  barrierLayers = [];

  console.log(`🔍 Отображение ${barrierData.length} барьеров на карте`);

  barrierData.forEach((el, index) => {
    console.log(`🔍 Барьер ${index + 1}:`, {
      type: el.type,
      osmid: el.osmid,
      natural: el.natural,
      barrier_type: el.barrier_type,
      geometry_points: el.geometry ? el.geometry.length : 0
    });

    if ((el.type === 'way' || el.type === 'barrier') && el.geometry && el.geometry.length > 1) {
      // Проверяем формат координат
      const latlngs = el.geometry.map(p => {
        if (Array.isArray(p)) {
          return [p[0], p[1]]; // [lat, lon]
        } else if (p && typeof p === 'object') {
          return [p.lat, p.lon]; // {lat, lon}
        } else {
          console.warn('🔍 Неизвестный формат координат барьера:', p);
          return null;
        }
      }).filter(coord => coord !== null);

      if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, {
          color: 'red', 
          weight: 4,
          opacity: 0.8
        }).addTo(map);
        barrierLayers.push(polyline);
        console.log(`🔍 Барьер ${el.osmid} отображен как красная линия с ${latlngs.length} точками`);
      }
    } else if (el.type === 'node' && el.lat && el.lon) {
      const marker = L.circleMarker([el.lat, el.lon], {
        color: 'red', 
        fillColor: 'red', 
        fillOpacity: 0.7, 
        radius: 6,
        weight: 2
      }).addTo(map);
      barrierLayers.push(marker);
      console.log(`🔍 Барьер-точка ${el.osmid} отображен как красный маркер`);
    }
  });

  barriers = barrierData;
  console.log(`🔍 Отображено ${barrierLayers.length} барьеров на карте`);
}

// Очистка маркеров точек
export function clearPointMarkers() {
  pointMarkers.forEach(marker => map.removeLayer(marker));
  pointMarkers = [];
}

// Очистка маркеров неудачных попыток
export function clearFailedAttemptMarkers() {
  failedAttemptMarkers.forEach(marker => map.removeLayer(marker));
  failedAttemptMarkers = [];
}

// Очистка отладочных слоёв графа
export function clearGraphDebugLayers() {
  graphDebugLayers.forEach(layer => map.removeLayer(layer));
  graphDebugLayers = [];
}

// Очистка линии маршрута
export function clearRouteLine() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
}

// Добавление маркера точки
export function addPointMarker(lat, lon, number) {
  const marker = L.marker([lat, lon], {
    icon: L.divIcon({
      className: 'custom-marker',
      html: `<div style="background: green; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white;">${number}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
  }).addTo(map);
  
  pointMarkers.push(marker);
  return marker;
}

// Добавление маркера неудачной попытки
export function addFailedAttemptMarker(lat, lon) {
  const marker = L.circleMarker([lat, lon], {
    color: 'red',
    fillColor: 'red',
    fillOpacity: 0.5,
    radius: 3
  }).addTo(map);
  
  failedAttemptMarkers.push(marker);
}

// Отображение отладочной информации графа
export function showGraphDebug(graph) {
  clearGraphDebugLayers();
  
  if (!graph || !graph.nodes || !graph.adj) {
    console.warn('🔍 Граф для отладки пуст или некорректен');
    return;
  }
  
  console.log(`🔍 Отображаем граф троп: ${graph.nodes.length} узлов, ${graph.adj.length} рёбер`);
  
  // Показываем только рёбра (убрали узлы для чистоты)
  const drawnEdges = new Set();
  let edgeCount = 0;
  
  graph.adj.forEach((neighbors, i) => {
    neighbors.forEach(j => {
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
      if (!drawnEdges.has(key)) {
        const line = L.polyline([
          [graph.nodes[i].lat, graph.nodes[i].lon],
          [graph.nodes[j].lat, graph.nodes[j].lon]
        ], {
          color: '#0066FF',  // Яркий синий цвет для графа троп
          weight: 3,         // Толстые линии для лучшей видимости
          opacity: 0.9,      // Высокая непрозрачность
          dashArray: '5, 5'  // Пунктирные линии для отличия от маршрута
        }).addTo(map);
        graphDebugLayers.push(line);
        drawnEdges.add(key);
        edgeCount++;
      }
    });
  });
  
  console.log(`🔍 Отображено ${edgeCount} рёбер графа троп синим цветом`);
}

// Геттеры для получения текущих значений
export function getSelectedBounds() {
  return selectedBounds;
}

export function getStartPoint() {
  return startPoint;
}

// Обновление переменных для внешнего доступа
export function updateSelectedBounds(bounds) {
  selectedBounds = bounds;
}

export function updateStartPoint(point) {
  startPoint = point;
}

// Обновление точки старта с перемещением маркера
export function updateStartPointPosition(lat, lng) {
  startPoint = { lat, lng };
  
  // Обновляем маркер на карте
  if (startMarker) {
    map.removeLayer(startMarker);
  }
  
  startMarker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkY0NDQ0IiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(map)
  .bindPopup('Точка старта (автоматически перемещена к ближайшей тропе)')
  .openPopup();
  
  console.log('Точка старта обновлена:', startPoint);
} 