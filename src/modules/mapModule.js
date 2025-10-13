/**
 * Модуль для работы с картой Leaflet
 * Управляет инициализацией карты, маркерами и визуализацией
 */

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
    selectedBounds = layer.getBounds();
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

  areas.forEach(el => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 2) {
      const latlngs = el.geometry.map(p => [p.lat, p.lon]);
      // Проверяем, замкнут ли полигон
      if (latlngs[0][0] === latlngs[latlngs.length-1][0] && latlngs[0][1] === latlngs[latlngs.length-1][1]) {
        const polygon = L.polygon(latlngs, {color: 'red', fillOpacity: 0.3}).addTo(map);
        closedAreaLayers.push(polygon);
      }
    }
    // Для relation можно добавить позже
  });

  closedAreas = areas;
}

// Отображение водоёмов на карте
export function showWaterAreasOnMap(areas) {
  // Удаляем старые полигоны
  waterAreaLayers.forEach(l => map.removeLayer(l));
  waterAreaLayers = [];

  areas.forEach(el => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 2) {
      const latlngs = el.geometry.map(p => [p.lat, p.lon]);
      // Проверяем, замкнут ли полигон
      if (latlngs[0][0] === latlngs[latlngs.length-1][0] && latlngs[0][1] === latlngs[latlngs.length-1][1]) {
        const polygon = L.polygon(latlngs, {color: 'blue', fillOpacity: 0.3}).addTo(map);
        waterAreaLayers.push(polygon);
      }
    }
    // Для relation можно добавить позже
  });

  waterAreas = areas;
}

// Отображение барьеров на карте
export function showBarriersOnMap(barrierData) {
  // Удаляем старые слои
  barrierLayers.forEach(l => map.removeLayer(l));
  barrierLayers = [];

  barrierData.forEach(el => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 1) {
      const latlngs = el.geometry.map(p => [p.lat, p.lon]);
      const polyline = L.polyline(latlngs, {color: 'orange', weight: 3}).addTo(map);
      barrierLayers.push(polyline);
    } else if (el.type === 'node' && el.lat && el.lon) {
      const marker = L.circleMarker([el.lat, el.lon], {
        color: 'orange', 
        fillColor: 'orange', 
        fillOpacity: 0.7, 
        radius: 5
      }).addTo(map);
      barrierLayers.push(marker);
    }
  });

  barriers = barrierData;
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
  
  // Показываем только рёбра (убрали узлы для чистоты)
  const drawnEdges = new Set();
  graph.adj.forEach((neighbors, i) => {
    neighbors.forEach(j => {
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
      if (!drawnEdges.has(key)) {
        const line = L.polyline([
          [graph.nodes[i].lat, graph.nodes[i].lon],
          [graph.nodes[j].lat, graph.nodes[j].lon]
        ], {
          color: '#8B00FF',  // Более яркий фиолетовый цвет
          weight: 2,         // Увеличили толщину линий
          opacity: 0.8       // Увеличили непрозрачность
        }).addTo(map);
        graphDebugLayers.push(line);
        drawnEdges.add(key);
      }
    });
  });
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