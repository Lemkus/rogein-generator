// Инициализация карты
const map = L.map('map').setView([60.1105, 30.3705], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Добавляем Leaflet Draw
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
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

let selectedBounds = null;
let startPoint = null; // Точка старта
let startMarker = null; // Маркер точки старта
let pointMarkers = [];
let closedAreas = [];
let closedAreaLayers = [];
let waterAreas = [];
let waterAreaLayers = [];
let barriers = [];
let barrierLayers = [];
let routeLine = null;
let failedAttemptMarkers = [];
let graphDebugLayers = []; // Для отладочной визуализации графа
let excludedPathSegments = []; // Для визуализации исключённых сегментов

map.on(L.Draw.Event.CREATED, function (event) {
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
});

// Обработка кнопки генерации
const btn = document.getElementById('generateBtn');
const pointsInput = document.getElementById('pointsCount');
const status = document.getElementById('status');
const minDistPercentInput = document.getElementById('minDistPercent');
const cancelBtn = document.getElementById('cancelBtn');

let cancelGeneration = false;

cancelBtn.addEventListener('click', () => {
  cancelGeneration = true;
  status.textContent = 'Отмена...';
  console.log('Генерация отменена пользователем.');
  btn.disabled = false;
  cancelBtn.style.display = 'none';
});

// Функция для расчёта расстояния между двумя точками (метры)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // радиус Земли в метрах
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Функция для вычисления площади прямоугольника (метры)
function rectangleArea(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  // ширина (по долготе, на средней широте)
  const midLat = (sw.lat + ne.lat) / 2;
  const width = haversine(midLat, sw.lng, midLat, ne.lng);
  // высота (по широте)
  const height = haversine(sw.lat, sw.lng, ne.lat, sw.lng);
  return width * height;
}

async function fetchClosedAreas(bounds) {
  // Формируем bbox для Overpass
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  // Overpass-запрос
  const query = `[
    out:json][timeout:25];
    (
      way["landuse"="military"](${bbox});
      relation["landuse"="military"](${bbox});
      way["military"](${bbox});
      relation["military"](${bbox});
      way["access"="private"](${bbox});
      relation["access"="private"](${bbox});
    );
    out geom;`;

  const url = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(url, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Ошибка Overpass API (закрытые зоны):', response.status, response.statusText, errorText);
    status.textContent = `Ошибка загрузки закрытых зон: ${response.status} ${response.statusText}. Попробуйте уменьшить область.`;
    throw new Error('Overpass API error');
  }
  const data = await response.json();
  return data.elements;
}

function showClosedAreasOnMap(areas) {
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
}

async function fetchWaterAreas(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:25];
    (
      way["natural"="water"](${bbox});
      relation["natural"="water"](${bbox});
      way["water"="lake"](${bbox});
      relation["water"="lake"](${bbox});
      way["landuse"="reservoir"](${bbox});
      relation["landuse"="reservoir"](${bbox});
      way["landuse"="basin"](${bbox});
      relation["landuse"="basin"](${bbox});
    );
    out geom;`;

  const url = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(url, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Ошибка Overpass API (водоёмы):', response.status, response.statusText, errorText);
    status.textContent = `Ошибка загрузки водоёмов: ${response.status} ${response.statusText}. Попробуйте уменьшить область.`;
    throw new Error('Overpass API error');
  }
  const data = await response.json();
  console.log('Водные объекты из Overpass:', data.elements);
  return data.elements;
}

function showWaterAreasOnMap(areas) {
  waterAreaLayers.forEach(l => map.removeLayer(l));
  waterAreaLayers = [];

  areas.forEach(el => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 2) {
      const latlngs = el.geometry.map(p => [p.lat, p.lon]);
      // Для диагностики отображаем все ways, даже если не замкнуты
      const polygon = L.polygon(latlngs, {color: 'blue', fillOpacity: 0.3}).addTo(map);
      waterAreaLayers.push(polygon);
    }
    // Добавляем обработку relation (мультиполигон)
    if (el.type === 'relation' && el.members) {
      // Ищем внешние полигоны (role: outer)
      const outers = el.members.filter(m => m.role === 'outer' && m.geometry && m.geometry.length > 2);
      outers.forEach(outer => {
        const latlngs = outer.geometry.map(p => [p.lat, p.lon]);
        const polygon = L.polygon(latlngs, {color: 'blue', fillOpacity: 0.3}).addTo(map);
        waterAreaLayers.push(polygon);
      });
    }
  });
}

async function fetchBarriers(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:25];
    (
      way["barrier"="fence"](${bbox});
      way["barrier"="wall"](${bbox});
      way["barrier"="hedge"](${bbox});
      way["barrier"="gate"](${bbox});
      way["barrier"="bollard"](${bbox});
      way["barrier"="cycle_barrier"](${bbox});
      way["barrier"="stile"](${bbox});
      way["barrier"="block"](${bbox});
      way["access"="no"](${bbox});
      way["access"="private"](${bbox});
      node["barrier"="gate"](${bbox});
      node["barrier"="bollard"](${bbox});
      node["barrier"="cycle_barrier"](${bbox});
      node["barrier"="stile"](${bbox});
      node["barrier"="lift_gate"](${bbox});
      node["barrier"="swing_gate"](${bbox});
      node["barrier"="barrier"](${bbox});
      way["barrier"="lift_gate"](${bbox});
      way["barrier"="swing_gate"](${bbox});
      way["barrier"="barrier"](${bbox});
    );
    out geom;`;

  const url = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(url, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Ошибка Overpass API (барьеры):', response.status, response.statusText, errorText);
    status.textContent = `Ошибка загрузки барьеров: ${response.status} ${response.statusText}. Попробуйте уменьшить область.`;
    throw new Error('Overpass API error');
  }
  const data = await response.json();
  console.log('Барьеры из Overpass:', data.elements);
  return data.elements;
}

function showBarriersOnMap(barriers) {
  barrierLayers.forEach(l => map.removeLayer(l));
  barrierLayers = [];

  barriers.forEach(el => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 1) {
      const latlngs = el.geometry.map(p => [p.lat, p.lon]);
      const barrierLine = L.polyline(latlngs, {
        color: 'orange', 
        weight: 3, 
        opacity: 0.8,
        dashArray: '10, 5'
      }).addTo(map)
        .bindPopup(`Барьер: ${el.tags?.barrier || el.tags?.access || 'неизвестно'}`);
      barrierLayers.push(barrierLine);
    } else if (el.type === 'node' && el.lat && el.lon) {
      // Точечные барьеры (ворота, столбики и т.д.)
      const barrierMarker = L.circleMarker([el.lat, el.lon], {
        radius: 6,
        color: 'orange',
        fillColor: 'orange',
        fillOpacity: 0.6
      }).addTo(map)
        .bindPopup(`Барьер: ${el.tags?.barrier || 'неизвестно'}`);
      barrierLayers.push(barrierMarker);
    }
  });
}

async function fetchPaths(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:25];
    (
      way["highway"="path"](${bbox});
      way["highway"="footway"](${bbox});
      way["highway"="cycleway"](${bbox});
      way["highway"="track"](${bbox});
      way["highway"="service"](${bbox});
      way["highway"="bridleway"](${bbox});
      way["highway"="unclassified"](${bbox});
      way["highway"="residential"](${bbox});
      way["highway"="living_street"](${bbox});
      way["highway"="steps"](${bbox});
      way["highway"="pedestrian"](${bbox});
      way["highway"="crossing"](${bbox});
      way["footway"="crossing"](${bbox});
    );
    out geom;`;

  const url = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(url, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Ошибка Overpass API (тропы):', response.status, response.statusText, errorText);
    status.textContent = `Ошибка загрузки троп: ${response.status} ${response.statusText}. Попробуйте уменьшить область.`;
    throw new Error('Overpass API error');
  }
  const data = await response.json();
  console.log('Тропы из Overpass:', data.elements);
  return data.elements;
}

function getRandomPointOnLine(line) {
  // line: массив точек [{lat,lon}, ...]
  // 1. Выбираем случайный сегмент
  const segIdx = Math.floor(Math.random() * (line.length - 1));
  const p1 = line[segIdx];
  const p2 = line[segIdx + 1];
  // 2. Случайная точка на сегменте
  const t = Math.random();
  const lat = p1.lat + t * (p2.lat - p1.lat);
  const lon = p1.lon + t * (p2.lon - p1.lon);
  return [lat, lon];
}

// Проверка: находится ли точка внутри полигона (алгоритм луча)
function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lon) !== (yj > lon)) &&
      (lat < (xj - xi) * (lon - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Получить массив всех внешних полигонов (массивов координат) из closedAreas/waterAreas
function extractPolygons(areaObjs) {
  const polygons = [];
  areaObjs.forEach(el => {
    if (el.type === 'way' && el.geometry && el.geometry.length > 2) {
      polygons.push(el.geometry.map(p => [p.lat, p.lon]));
    }
    if (el.type === 'relation' && el.members) {
      const outers = el.members.filter(m => m.role === 'outer' && m.geometry && m.geometry.length > 2);
      outers.forEach(outer => {
        polygons.push(outer.geometry.map(p => [p.lat, p.lon]));
      });
    }
  });
  return polygons;
}

// Проверка: пересекает ли отрезок (p1, p2) полигон (poly)
function segmentIntersectsPolygon(p1, p2, poly) {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const q1 = {lat: poly[j][0], lon: poly[j][1]};
    const q2 = {lat: poly[i][0], lon: poly[i][1]};
    if (segmentsIntersect(p1, p2, q1, q2)) return true;
  }
  return false;
}

// Проверка пересечения двух отрезков (p1,p2) и (q1,q2)
function segmentsIntersect(p1, p2, q1, q2) {
  function ccw(a, b, c) {
    return (c.lat - a.lat) * (b.lon - a.lon) > (b.lat - a.lat) * (c.lon - a.lon);
  }
  return (ccw(p1, q1, q2) !== ccw(p2, q1, q2)) && (ccw(p1, p2, q1) !== ccw(p1, p2, q2));
}

// Проверка: пересекает ли отрезок (p1, p2) какой-либо барьер
function segmentIntersectsBarriers(p1, p2, barrierObjs) {
  for (const barrier of barrierObjs) {
    if (barrier.type === 'way' && barrier.geometry && barrier.geometry.length > 1) {
      // Линейные барьеры (заборы, стены)
      for (let i = 0; i < barrier.geometry.length - 1; i++) {
        const q1 = {lat: barrier.geometry[i].lat, lon: barrier.geometry[i].lon};
        const q2 = {lat: barrier.geometry[i+1].lat, lon: barrier.geometry[i+1].lon};
        if (segmentsIntersect(p1, p2, q1, q2)) {
          return {intersects: true, barrier: barrier.tags?.barrier || barrier.tags?.access || 'неизвестный барьер'};
        }
      }
    } else if (barrier.type === 'node' && barrier.lat && barrier.lon) {
      // Точечные барьеры - проверяем близость к линии сегмента
      const barrierPoint = {lat: barrier.lat, lon: barrier.lon};
      const distanceToSegment = distancePointToSegment(barrierPoint, p1, p2);
      if (distanceToSegment < 5) { // Если барьер в пределах 5 метров от сегмента
        return {intersects: true, barrier: barrier.tags?.barrier || 'точечный барьер'};
      }
    }
  }
  return {intersects: false, barrier: null};
}

// Функция для вычисления расстояния от точки до отрезка
function distancePointToSegment(point, segStart, segEnd) {
  const A = point.lat - segStart.lat;
  const B = point.lon - segStart.lon;
  const C = segEnd.lat - segStart.lat;
  const D = segEnd.lon - segStart.lon;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // Сегмент вырожден в точку
    return haversine(point.lat, point.lon, segStart.lat, segStart.lon);
  }
  
  let t = dot / lenSq;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  
  const projection = {
    lat: segStart.lat + t * C,
    lon: segStart.lon + t * D
  };
  
  return haversine(point.lat, point.lon, projection.lat, projection.lon);
}

// Построение графа троп с удалением рёбер, пересекающих запрещённые зоны
function buildPathGraph(paths, forbiddenPolygons, barrierObjs = []) {
  const nodes = []; // Stores {lat, lon} objects for graph nodes
  const edges = [];
  const nodeTolerance = 0.5; // Meters. Nodes within this distance are considered the same.

  // Helper function to find the index of an existing node or add a new one
  function getOrCreateNodeIndex(lat, lon) {
    for (let i = 0; i < nodes.length; i++) {
      if (haversine(lat, lon, nodes[i].lat, nodes[i].lon) < nodeTolerance) {
        return i; // Found an existing node within tolerance
      }
    }
    // No existing node found within tolerance, add a new one
    nodes.push({lat, lon});
    return nodes.length - 1;
  }

  // Collect all unique nodes from all paths (snapping close points)
  paths.forEach(path => {
    if (!path.geometry || path.geometry.length < 2) return;
    path.geometry.forEach(pt => {
      getOrCreateNodeIndex(pt.lat, pt.lon); // Just call to populate nodes array
    });
  });

  // Add edges between neighboring points of each path if they don't intersect forbidden areas or barriers
  const tempExcludedSegments = [];
  paths.forEach(path => {
    if (!path.geometry || path.geometry.length < 2) return;
    for (let i = 0; i < path.geometry.length - 1; i++) {
      const a = path.geometry[i];
      const b = path.geometry[i+1];
      let forbidden = false;
      let reason = '';

      // Check for intersection with forbidden polygons
      for (const poly of forbiddenPolygons) {
        if (segmentIntersectsPolygon(a, b, poly)) {
          forbidden = true;
          reason = `Пересекает запретную зону (полигон ${poly[0][0].toFixed(4)}, ${poly[0][1].toFixed(4)}...)`;
          break;
        }
      }

      // Check for intersection with barriers
      if (!forbidden) {
        const barrierCheck = segmentIntersectsBarriers(a, b, barrierObjs);
        if (barrierCheck.intersects) {
          forbidden = true;
          reason = `Пересекает барьер: ${barrierCheck.barrier}`;
        }
      }

      if (!forbidden) {
        // Get indices for the current segment's start and end points
        const idxA = getOrCreateNodeIndex(a.lat, a.lon);
        const idxB = getOrCreateNodeIndex(b.lat, b.lon);

        if (idxA !== idxB) { // Ensure it's not a self-loop (e.g., from snapping very close points)
          edges.push([idxA, idxB]);
          edges.push([idxB, idxA]); // Undirected graph
        } else {
          // This happens if a and b are snapped to the same node due to nodeTolerance
          tempExcludedSegments.push({segment: [a, b], reason: `Сегмент слишком короткий или узлы слились (расстояние < ${nodeTolerance}м)`});
        }
      } else {
        tempExcludedSegments.push({segment: [a, b], reason: reason});
      }
    }
  });
  excludedPathSegments = tempExcludedSegments;

  // Build adjacency list (ensure no duplicate edges for same (u,v))
  const adj = Array(nodes.length).fill(0).map(() => []);
  const edgeSet = new Set();
  edges.forEach(([u, v]) => {
    const key1 = `${u}-${v}`;
    const key2 = `${v}-${u}`;
    if (!edgeSet.has(key1)) {
      adj[u].push(v);
      adj[v].push(u); // Add for both directions since it's undirected
      edgeSet.add(key1);
      edgeSet.add(key2);
    }
  });

  return {nodes, adj};
}

// BFS для проверки достижимости
function isReachable(graph, fromIdx, toIdx) {
  const visited = new Set();
  const queue = [fromIdx];
  while (queue.length) {
    const v = queue.shift();
    if (v === toIdx) return true;
    for (const u of graph.adj[v]) {
      if (!visited.has(u)) {
        visited.add(u);
        queue.push(u);
      }
    }
  }
  return false;
}

// Алгоритм Дейкстры для поиска кратчайшего пути в графе
function dijkstra(graph, startIdx, endIdx) {
  const dist = Array(graph.nodes.length).fill(Infinity);
  const prev = Array(graph.nodes.length).fill(null);
  dist[startIdx] = 0;
  const visited = new Set();
  while (true) {
    // Находим не посещённую вершину с минимальным расстоянием
    let u = -1;
    let minDist = Infinity;
    for (let i = 0; i < dist.length; i++) {
      if (!visited.has(i) && dist[i] < minDist) {
        minDist = dist[i];
        u = i;
      }
    }
    if (u === -1 || u === endIdx) break;
    visited.add(u);
    for (const v of graph.adj[u]) {
      const d = haversine(graph.nodes[u].lat, graph.nodes[u].lon, graph.nodes[v].lat, graph.nodes[v].lon);
      if (dist[u] + d < dist[v]) {
        dist[v] = dist[u] + d;
        prev[v] = u;
      }
    }
  }
  // Восстанавливаем путь (если нужно)
  let path = [];
  let cur = endIdx;
  if (dist[endIdx] < Infinity) {
    while (cur !== null) {
      path.push(cur);
      cur = prev[cur];
    }
    path.reverse();
  }
  return {distance: dist[endIdx], path};
}

btn.addEventListener('click', async () => {
  if (!selectedBounds) {
    status.textContent = 'Сначала выделите область на карте!';
    return;
  }
  if (!startPoint) {
    status.textContent = 'Сначала установите точку старта на карте!';
    return;
  }
  const count = parseInt(pointsInput.value, 10);
  if (isNaN(count) || count < 1) {
    status.textContent = 'Введите корректное количество точек!';
    return;
  }
  const percent = parseFloat(minDistPercentInput.value);
  if (isNaN(percent) || percent <= 0) {
    status.textContent = 'Введите корректный процент для мин. расстояния!';
    return;
  }

  btn.disabled = true; // Отключаем кнопку генерации
  cancelBtn.style.display = 'inline-block'; // Показываем кнопку отмены
  cancelGeneration = false; // Сбрасываем флаг отмены

  status.textContent = 'Загрузка данных OSM...';

  const sw = selectedBounds.getSouthWest();
  const ne = selectedBounds.getNorthEast();

  // Вычисляем площадь области и минимальное расстояние
  const area = rectangleArea(selectedBounds); // в м^2
  const circleArea = area * (percent / 100);
  const minDist = Math.sqrt(circleArea / Math.PI);
  console.log(`Площадь области: ${area.toFixed(0)} м², мин. расстояние: ${minDist.toFixed(1)} м`);

  // Оценка максимального количества точек
  const Nmax = Math.floor(area / (circleArea * 1.2)); // Небольшой запас, т.к. не все 100% площади будут использованы
  if (count > Nmax) {
    status.textContent = `Слишком много точек (${count}) или слишком большой процент (${percent}%) для данной области! Максимум: ${Nmax}. Попробуйте уменьшить количество точек или процент, или увеличить область.`;
    btn.disabled = false;
    cancelBtn.style.display = 'none';
    return;
  }

  try {
    // Извлекаем полигоны закрытых зон и водоёмов
    closedAreas = await fetchClosedAreas(selectedBounds);
    showClosedAreasOnMap(closedAreas);

    waterAreas = await fetchWaterAreas(selectedBounds);
    showWaterAreasOnMap(waterAreas);

    // Получаем барьеры
    barriers = await fetchBarriers(selectedBounds);
    showBarriersOnMap(barriers);

    // Получаем тропы
    const paths = await fetchPaths(selectedBounds);
    status.textContent = `Найдено троп: ${paths.length}, закрытых зон: ${closedAreas.length}, водоёмов: ${waterAreas.length}, барьеров: ${barriers.length}. Генерация точек...`;
    console.log('--- Генерация точек ---');
    console.log(`Параметры: count=${count}, percent=${percent}, minDist=${minDist.toFixed(1)} м, площадь области=${area.toFixed(0)} м²`);
    console.log(`Троп найдено: ${paths.length}, закрытых зон: ${closedAreas.length}, водоёмов: ${waterAreas.length}, барьеров: ${barriers.length}`);

    // Очищаем старые маркеры неудачных попыток и отладочную визуализацию графа
    failedAttemptMarkers.forEach(m => map.removeLayer(m));
    failedAttemptMarkers = [];
    graphDebugLayers.forEach(l => map.removeLayer(l));
    graphDebugLayers = [];
    excludedPathSegments.forEach(l => map.removeLayer(l)); // Очищаем и исключённые сегменты
    excludedPathSegments = [];
    barrierLayers.forEach(l => map.removeLayer(l)); // Очищаем барьеры
    barrierLayers = [];

    // Извлекаем полигоны закрытых зон и водоёмов
    const closedPolygons = extractPolygons(closedAreas);
    const waterPolygons = extractPolygons(waterAreas);
    const forbiddenPolygons = closedPolygons.concat(waterPolygons);

    // Строим граф троп
    const pathGraph = buildPathGraph(paths, forbiddenPolygons, barriers);
    console.log('Построенный граф троп:', pathGraph.nodes.length, 'узлов,', pathGraph.adj.flat().length/2, 'рёбер');
    
    // Привязываем стартовую точку к ближайшему узлу графа
    const originalStartNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, pathGraph.nodes);
    if (originalStartNodeIdx === -1) {
      // Если стартовая точка слишком далеко от графа, ищем ближайший узел без ограничения расстояния
      let minDistance = Infinity;
      let nearestNodeIdx = -1;
      for (let i = 0; i < pathGraph.nodes.length; i++) {
        const distance = haversine(startPoint.lat, startPoint.lng, pathGraph.nodes[i].lat, pathGraph.nodes[i].lon);
        if (distance < minDistance) {
          minDistance = distance;
          nearestNodeIdx = i;
        }
      }
      if (nearestNodeIdx !== -1) {
        const nearestNode = pathGraph.nodes[nearestNodeIdx];
        console.log(`Стартовая точка привязана к ближайшему узлу графа. Расстояние: ${minDistance.toFixed(1)} м`);
        
        // Обновляем позицию стартового маркера
        if (startMarker) {
          map.removeLayer(startMarker);
        }
        startPoint = { lat: nearestNode.lat, lng: nearestNode.lon };
        startMarker = L.marker([startPoint.lat, startPoint.lng], {
          icon: L.icon({
            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkY0NDQ0IiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(map)
        .bindPopup(`Точка старта (привязана к тропе, сдвиг: ${minDistance.toFixed(1)} м)`)
        .openPopup();
        
        status.textContent = `Стартовая точка привязана к ближайшей тропе (сдвиг: ${minDistance.toFixed(1)} м). Генерация точек...`;
      } else {
        status.textContent = 'Ошибка: не удалось найти узлы графа троп для привязки стартовой точки.';
        btn.disabled = false;
        cancelBtn.style.display = 'none';
        return;
      }
    } else {
      console.log('Стартовая точка уже находится рядом с тропой');
      status.textContent = 'Стартовая точка привязана к тропе. Генерация точек...';
    }

    // --- Отладочная визуализация графа --- 
    // Рисуем все рёбра графа (фиолетовым цветом)
    pathGraph.adj.forEach((neighbors, u) => {
      const nodeU = pathGraph.nodes[u];
      neighbors.forEach(v => {
        if (u < v) { // Рисуем только в одну сторону, чтобы не дублировать линии
          const nodeV = pathGraph.nodes[v];
          const segmentLine = L.polyline([[nodeU.lat, nodeU.lon], [nodeV.lat, nodeV.lon]], {
            color: 'purple', // Фиолетовый цвет для рёбер графа
            weight: 2,
            opacity: 0.5
          }).addTo(map);
          graphDebugLayers.push(segmentLine);
        }
      });
    });
    // --- Конец отладочной визуализации графа ---

    // --- Отладочная визуализация исключённых сегментов --- 
    excludedPathSegments.forEach(item => {
      const segment = item.segment;
      const line = L.polyline([[segment[0].lat, segment[0].lon], [segment[1].lat, segment[1].lon]], {
        color: 'brown', // Коричневый цвет для исключённых сегментов
        weight: 3,
        opacity: 0.8,
        dashArray: '5, 10' // Пунктирная линия
      }).addTo(map)
        .bindPopup(`Исключённый сегмент: ${item.reason}`);
      excludedPathSegments.push(line); // Сохраняем ссылку на слой для очистки
    });
    // --- Конец отладочной визуализации исключённых сегментов ---

    // Генерируем точки с учётом связности
    pointMarkers.forEach(m => map.removeLayer(m));
    pointMarkers = [];
    const finalPoints = [];
    const maxAttempts = 1000 * count; // Общий лимит попыток
    let attempts = 0; // Общие попытки для всех точек

    while (finalPoints.length < count && attempts < maxAttempts && !cancelGeneration) {
      await new Promise(r => setTimeout(r, 0)); // Даём браузеру подышать

      let candidate = null;
      let candidateNodeIdx = -1;
      let candidateTries = 0; // Попытки для текущей точки
      let reason = '';
      const maxCandidateTries = 200; // Лимит попыток для одной точки
      let lastCandidateCoords = null; // Для визуализации неудачных попыток

      while (candidateTries < maxCandidateTries && !cancelGeneration) {
        const path = paths[Math.floor(Math.random() * paths.length)];
        if (!path.geometry || path.geometry.length < 2) {
          candidateTries++;
          reason = 'Некорректная тропа';
          continue;
        }
        const [lat, lon] = getRandomPointOnLine(path.geometry);
        lastCandidateCoords = [lat, lon]; // Сохраняем координаты для потенциальной визуализации

        // Проверки (расстояние, полигоны)
        let tooClose = false;
        for (const [plat, plon] of finalPoints) {
          if (haversine(lat, lon, plat, plon) < minDist) {
            tooClose = true;
            reason = 'Слишком близко к другой точке';
            break;
          }
        }
        let inClosed = false;
        for (const poly of closedPolygons) {
          if (pointInPolygon(lat, lon, poly)) {
            inClosed = true;
            reason = 'В закрытой зоне';
            break;
          }
        }
        let inWater = false;
        for (const poly of waterPolygons) {
          if (pointInPolygon(lat, lon, poly)) {
            inWater = true;
            reason = 'В водоёме';
            break;
          }
        }
        if (tooClose || inClosed || inWater) {
          candidateTries++;
          continue;
        }
        const nodeIdx = findNearestNodeIdx(lat, lon, pathGraph.nodes);
        if (nodeIdx === -1) { // Если не нашли ближайший узел графа
          candidateTries++;
          reason = 'Нет ближайшего узла графа';
          continue;
        }

        // Проверяем связность со стартовой точкой
        const startNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, pathGraph.nodes);
        if (startNodeIdx === -1) {
          reason = 'Стартовая точка не связана с графом троп';
          candidateTries++;
          continue;
        }
        
        if (!isReachable(pathGraph, nodeIdx, startNodeIdx)) {
          reason = 'Не связана со стартовой точкой';
          candidateTries++;
          continue;
        }

        if (finalPoints.length === 0) {
          candidate = [lat, lon];
          candidateNodeIdx = nodeIdx;
          break;
        } else {
          let connected = false;
          for (const pt of finalPoints) {
            const idx2 = findNearestNodeIdx(pt[0], pt[1], pathGraph.nodes);
            if (idx2 === -1) { // Если у существующей точки нет узла графа
              connected = false; // Считаем несвязным для текущей попытки
              break;
            }
            // Проверка связности только для разрешённых путей
            if (isReachable(pathGraph, nodeIdx, idx2)) {
              connected = true;
              break;
            }
          }
          if (connected) {
            candidate = [lat, lon];
            candidateNodeIdx = nodeIdx;
            break;
          } else {
            reason = 'Не связана с другими точками';
          }
        }
        candidateTries++;
      } // Конец while (candidateTries < maxCandidateTries)

      if (candidate) {
        finalPoints.push(candidate);
        console.log(`Точка ${finalPoints.length}: (${candidate[0].toFixed(6)}, ${candidate[1].toFixed(6)}) успешно добавлена`);
        status.textContent = `Генерация точек: ${finalPoints.length} из ${count}...`;
      } else {
        // Если точка не была найдена после maxCandidateTries попыток
        if (lastCandidateCoords) {
          let markerColor = 'black'; // Цвет по умолчанию
          switch (reason) {
            case 'Слишком близко к другой точке':
              markerColor = 'green';
              break;
            case 'В закрытой зоне':
              markerColor = 'red';
              break;
            case 'В водоёме':
              markerColor = 'blue';
              break;
            case 'Не связана с другими точками':
              markerColor = 'yellow';
              break;
            default:
              markerColor = 'gray'; // Для других или неизвестных причин
          }

          const failedMarker = L.circleMarker(lastCandidateCoords, {
            radius: 4,
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: 0.4
          }).addTo(map)
            .bindPopup(`Неудачная попытка: ${reason || 'Неизвестная причина'}`);
          failedAttemptMarkers.push(failedMarker);
        }
        console.log(`Попытка ${attempts + 1}: не удалось добавить точку (${reason || 'Неизвестная причина'}). ${finalPoints.length} точек уже добавлено.`);
        if (finalPoints.length < count) {
          status.textContent = `Не удалось разместить все точки (${finalPoints.length}/${count}). Возможно, слишком мало троп или область очень ограничена.`;
        }
      }
      attempts++;
    } // Конец while (finalPoints.length < count)

    console.log(`Итого сгенерировано точек: ${finalPoints.length} из ${count}`);
    if (finalPoints.length < count && !cancelGeneration) {
      console.warn('Не удалось сгенерировать все точки. Возможно, слишком мало троп или слишком большой процент/расстояние.');
    } else if (cancelGeneration) {
      status.textContent = `Генерация отменена. Размещено точек: ${finalPoints.length}`; 
    } else {
      status.textContent = `Готово! Размещено точек: ${finalPoints.length}`; 
    }

    // Отображаем точки
    for (let i = 0; i < finalPoints.length; i++) {
      const [lat, lon] = finalPoints[i];
      const marker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`Точка ${i + 1}`);
      pointMarkers.push(marker);
    }

    // Возвращаем кнопки в исходное состояние
    btn.disabled = false;
    cancelBtn.style.display = 'none';

    // Обновляем список точек после генерации
    updateTargetPointsList();
  } catch (error) {
    console.error('Произошла ошибка во время загрузки данных или генерации:', error);
    btn.disabled = false;
    cancelBtn.style.display = 'none';
  }
});

// Находим ближайший узел графа для точки (с учётом толерантности)
function findNearestNodeIdx(lat, lon, nodes) {
  let minD = Infinity, idx = -1;
  const snapToleranceForPoint = 10; // Meters. How close a generated point needs to be to a graph node.
  for (let i = 0; i < nodes.length; i++) {
    const d = haversine(lat, lon, nodes[i].lat, nodes[i].lon);
    if (d < minD) {
      minD = d;
      idx = i;
    }
  }
  return (minD < snapToleranceForPoint) ? idx : -1; // Only return if within snapTolerance
}

// --- GPX экспорт ---
const downloadGpxBtn = document.getElementById('downloadGpxBtn');
downloadGpxBtn.addEventListener('click', () => {
  if (!startPoint) {
    alert('Сначала установите точку старта!');
    return;
  }
  if (!pointMarkers || pointMarkers.length === 0) {
    alert('Сначала сгенерируйте точки!');
    return;
  }
  // Формируем GPX
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  gpx += `<gpx version="1.1" creator="RogainApp" xmlns="http://www.topografix.com/GPX/1/1">\n`;
  
  // Добавляем стартовую точку первой
  gpx += `  <wpt lat=\"${startPoint.lat}\" lon=\"${startPoint.lng}\">\n    <name>СТАРТ</name>\n    <desc>Точка старта</desc>\n  </wpt>\n`;
  
  // Добавляем остальные точки
  pointMarkers.forEach((marker, i) => {
    const lat = marker.getLatLng().lat;
    const lon = marker.getLatLng().lng;
    gpx += `  <wpt lat=\"${lat}\" lon=\"${lon}\">\n    <name>Точка ${i+1}</name>\n  </wpt>\n`;
  });
  gpx += `</gpx>`;

  // Скачиваем файл
  const blob = new Blob([gpx], {type: 'application/gpx+xml'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rogain_points.gpx';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
});

// --- Вибро-навигация "Горячо-Холодно" ---
const targetPointSelect = document.getElementById('targetPointSelect');
const vibroNavBtn = document.getElementById('vibroNavBtn');
const stopNavBtn = document.getElementById('stopNavBtn');
const navStatus = document.getElementById('navStatus');

let isNavigating = false;
let currentTarget = null;
let lastDistance = null;
let navigationInterval = null;
let userPosition = null;
let watchId = null;

// Обновляем список точек после генерации
function updateTargetPointsList() {
  targetPointSelect.innerHTML = '';
  
  if (pointMarkers.length === 0) {
    targetPointSelect.innerHTML = '<option value="">Сначала сгенерируйте точки</option>';
    targetPointSelect.disabled = true;
    vibroNavBtn.disabled = true;
    return;
  }
  
  // Добавляем стартовую точку
  if (startPoint) {
    const option = document.createElement('option');
    option.value = 'start';
    option.textContent = 'СТАРТ';
    targetPointSelect.appendChild(option);
  }
  
  // Добавляем все сгенерированные точки
  pointMarkers.forEach((marker, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Точка ${i + 1}`;
    targetPointSelect.appendChild(option);
  });
  
  targetPointSelect.disabled = false;
  vibroNavBtn.disabled = false;
}

// Функция вибрации с разными паттернами
function vibratePattern(pattern) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  } else {
    console.log('Вибрация не поддерживается:', pattern);
  }
}

// Получение координат целевой точки
function getTargetCoords() {
  const selectedValue = targetPointSelect.value;
  if (selectedValue === 'start' && startPoint) {
    return { lat: startPoint.lat, lng: startPoint.lng };
  } else if (selectedValue !== '' && pointMarkers[selectedValue]) {
    const marker = pointMarkers[selectedValue];
    return marker.getLatLng();
  }
  return null;
}

// Основная логика навигации
function navigationStep() {
  if (!isNavigating || !userPosition || !currentTarget) return;
  
  const distance = haversine(userPosition.lat, userPosition.lng, currentTarget.lat, currentTarget.lng);
  
  // Обновляем статус
  navStatus.textContent = `📍 ${distance.toFixed(0)}м`;
  
  // Проверяем достижение цели
  if (distance < 5) {
    vibratePattern([200, 100, 200, 100, 200]); // Сигнал "цель достигнута"
    navStatus.textContent = '🎯 Цель достигнута!';
    navStatus.style.color = 'green';
    setTimeout(() => {
      navStatus.style.color = 'black';
    }, 3000);
    return;
  }
  
  // Определяем паттерн вибрации на основе расстояния
  let vibrateDelay, pattern;
  
  if (distance < 20) {
    // Очень близко - непрерывная вибрация
    pattern = [100];
    vibrateDelay = 500;
  } else if (distance < 50) {
    // Очень горячо
    pattern = [50];
    vibrateDelay = 1000;
  } else if (distance < 100) {
    // Горячо
    pattern = [80];
    vibrateDelay = 2000;
  } else if (distance < 200) {
    // Тепло
    pattern = [100];
    vibrateDelay = 3000;
  } else if (distance < 500) {
    // Прохладно
    pattern = [150];
    vibrateDelay = 5000;
  } else {
    // Холодно
    pattern = [200];
    vibrateDelay = 10000;
  }
  
  // Дополнительная логика: если отдаляемся, делаем вибрацию длиннее и реже
  if (lastDistance !== null && distance > lastDistance + 2) {
    pattern = [300]; // Длинная вибрация при отдалении
    vibrateDelay = Math.min(vibrateDelay * 1.5, 15000);
  }
  
  vibratePattern(pattern);
  lastDistance = distance;
  
  // Планируем следующую проверку
  clearTimeout(navigationInterval);
  navigationInterval = setTimeout(navigationStep, vibrateDelay);
}

// Обработка изменения позиции пользователя
function onPositionUpdate(position) {
  userPosition = {
    lat: position.coords.latitude,
    lng: position.coords.longitude
  };
  
  if (isNavigating) {
    navigationStep();
  }
}

// Обработка ошибок геолокации
function onPositionError(error) {
  navStatus.textContent = `❌ Ошибка геолокации: ${error.message}`;
  navStatus.style.color = 'red';
}

// Начало навигации
vibroNavBtn.addEventListener('click', () => {
  const target = getTargetCoords();
  if (!target) {
    alert('Выберите целевую точку!');
    return;
  }
  
  currentTarget = target;
  isNavigating = true;
  lastDistance = null;
  
  // Запрашиваем геолокацию
  if ('geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      onPositionUpdate, 
      onPositionError,
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000
      }
    );
    
    navStatus.textContent = '🔍 Поиск GPS...';
    navStatus.style.color = 'blue';
    
    vibroNavBtn.style.display = 'none';
    stopNavBtn.style.display = 'inline-block';
    
    // Приветственная вибрация
    vibratePattern([100, 100, 100]);
  } else {
    alert('Геолокация не поддерживается вашим браузером!');
  }
});

// Остановка навигации
stopNavBtn.addEventListener('click', () => {
  isNavigating = false;
  
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  
  if (navigationInterval) {
    clearTimeout(navigationInterval);
    navigationInterval = null;
  }
  
  navStatus.textContent = '';
  vibroNavBtn.style.display = 'inline-block';
  stopNavBtn.style.display = 'none';
  
  // Финальная вибрация
  vibratePattern([200]);
});