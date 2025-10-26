/**
 * Модуль алгоритмов для работы с графами и геометрией
 * Включает построение графа троп, алгоритм Дейкстры и проверки пересечений
 */

import { haversine, segmentIntersectsPolygon, segmentsIntersect, extractPolygons, distancePointToSegment } from './utils.js';

// Функция для проверки пересечения отрезка с барьерами
export function segmentIntersectsBarriers(p1, p2, barrierObjs) {
  for (const barrier of barrierObjs) {
    
    if ((barrier.type === 'way' || barrier.type === 'barrier') && barrier.geometry && barrier.geometry.length > 1) {
      // Проверяем пересечение со всеми сегментами барьера-линии
      for (let i = 0; i < barrier.geometry.length - 1; i++) {
        const b1 = barrier.geometry[i];
        const b2 = barrier.geometry[i + 1];
        
        // Проверяем формат координат
        let lat1, lon1, lat2, lon2;
        if (Array.isArray(b1)) {
          lat1 = b1[0]; lon1 = b1[1];
        } else if (b1 && typeof b1 === 'object') {
          lat1 = b1.lat; lon1 = b1.lon;
        } else {
          continue;
        }
        
        if (Array.isArray(b2)) {
          lat2 = b2[0]; lon2 = b2[1];
        } else if (b2 && typeof b2 === 'object') {
          lat2 = b2.lat; lon2 = b2.lon;
        } else {
          continue;
        }
        
        const barrierPoint1 = { lat: lat1, lon: lon1 };
        const barrierPoint2 = { lat: lat2, lon: lon2 };
        
        if (segmentsIntersect(p1, p2, barrierPoint1, barrierPoint2)) {
          return {
            intersects: true,
            barrier: `Barrier ${barrier.osmid || 'unknown'} (${barrier.natural || barrier.barrier_type || 'unknown'})`
          };
        }
      }
    } else if (barrier.type === 'node' && barrier.lat && barrier.lon) {
      // Проверяем близость к барьеру-точке
      const barrierPoint = { lat: barrier.lat, lon: barrier.lon };
      const distanceToBarrier = distancePointToSegment(barrierPoint, p1, p2);
      if (distanceToBarrier < 5) { // 5 метров tolerance
        return {
          intersects: true,
          barrier: `Node ${barrier.osmid || 'unknown'} (${barrier.natural || barrier.barrier_type || 'unknown'})`
        };
      }
    }
  }
  return { intersects: false };
}

// Построение графа троп с удалением рёбер, пересекающих запрещённые зоны (ОПТИМИЗИРОВАННАЯ ВЕРСИЯ)
export function buildPathGraph(paths, forbiddenPolygons, barrierObjs = []) {
  const nodes = []; 
  const edges = [];
  const nodeTolerance = 0.5; // Meters
  const excludedSegments = [];

  // ОПТИМИЗАЦИЯ 1: Spatial Grid Hash для быстрого поиска узлов
  // Разбиваем пространство на сетку ячеек
  const GRID_SIZE = 0.001; // ~100 метров на ячейку
  const spatialGrid = new Map(); // key: "lat_grid,lon_grid" -> array of node indices
  
  function getGridKey(lat, lon) {
    const latGrid = Math.floor(lat / GRID_SIZE);
    const lonGrid = Math.floor(lon / GRID_SIZE);
    return `${latGrid},${lonGrid}`;
  }
  
  function getNeighborGridKeys(lat, lon) {
    // Возвращает текущую ячейку и 8 соседних для поиска
    const latGrid = Math.floor(lat / GRID_SIZE);
    const lonGrid = Math.floor(lon / GRID_SIZE);
    const keys = [];
    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLon = -1; dLon <= 1; dLon++) {
        keys.push(`${latGrid + dLat},${lonGrid + dLon}`);
      }
    }
    return keys;
  }

  // ОПТИМИЗИРОВАННАЯ функция поиска/создания узла
  function getOrCreateNodeIndex(lat, lon) {
    // Ищем только в соседних ячейках сетки (9 ячеек вместо всех узлов)
    const neighborKeys = getNeighborGridKeys(lat, lon);
    
    for (const key of neighborKeys) {
      const cellNodes = spatialGrid.get(key);
      if (cellNodes) {
        for (const nodeIdx of cellNodes) {
          const node = nodes[nodeIdx];
          if (haversine(lat, lon, node.lat, node.lon) < nodeTolerance) {
            return nodeIdx; // Нашли существующий узел
          }
        }
      }
    }
    
    // Узел не найден, создаем новый
    const newIdx = nodes.length;
    nodes.push({lat, lon});
    
    // Добавляем в пространственную сетку
    const gridKey = getGridKey(lat, lon);
    if (!spatialGrid.has(gridKey)) {
      spatialGrid.set(gridKey, []);
    }
    spatialGrid.get(gridKey).push(newIdx);
    
    return newIdx;
  }

  // ОПТИМИЗАЦИЯ 2: Предварительный расчет bounding boxes для запретных зон
  const forbiddenBBoxes = forbiddenPolygons.map(poly => {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    
    for (const point of poly) {
      const lat = point[0];
      const lon = point[1];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    
    return { minLat, maxLat, minLon, maxLon, poly };
  });

  // Быстрая проверка пересечения сегмента с bbox
  function segmentIntersectsBBox(a, b, bbox) {
    const segMinLat = Math.min(a.lat, b.lat);
    const segMaxLat = Math.max(a.lat, b.lat);
    const segMinLon = Math.min(a.lon, b.lon);
    const segMaxLon = Math.max(a.lon, b.lon);
    
    // Если bboxы не пересекаются - сегмент точно не пересекает полигон
    return !(segMaxLat < bbox.minLat || segMinLat > bbox.maxLat ||
             segMaxLon < bbox.minLon || segMinLon > bbox.maxLon);
  }

  // Collect all unique nodes from all paths (snapping close points)
  console.log('📍 Сбор уникальных узлов...');
  let processedPoints = 0;
  
  paths.forEach(path => {
    if (!path.geometry || path.geometry.length < 2) return;
    path.geometry.forEach(pt => {
      let lat, lon;
      
      if (Array.isArray(pt)) {
        lat = pt[0];
        lon = pt[1];
      } else if (pt && typeof pt === 'object') {
        lat = pt.lat;
        lon = pt.lon;
      } else {
        return;
      }
      
      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        return;
      }
      
      getOrCreateNodeIndex(lat, lon);
      processedPoints++;
    });
  });
  
  console.log(`✅ Обработано ${processedPoints} точек → ${nodes.length} уникальных узлов`);

  // Add edges between neighboring points of each path
  console.log('🔗 Построение рёбер с проверкой запретных зон...');
  let processedSegments = 0;
  let bboxRejections = 0; // Счетчик отсеянных по bbox
  
  paths.forEach(path => {
    if (!path.geometry || path.geometry.length < 2) return;
    for (let i = 0; i < path.geometry.length - 1; i++) {
      const ptA = path.geometry[i];
      const ptB = path.geometry[i+1];
      
      let latA, lonA, latB, lonB;
      
      if (Array.isArray(ptA)) {
        latA = ptA[0]; lonA = ptA[1];
      } else if (ptA && typeof ptA === 'object') {
        latA = ptA.lat; lonA = ptA.lon;
      } else {
        continue;
      }
      
      if (Array.isArray(ptB)) {
        latB = ptB[0]; lonB = ptB[1];
      } else if (ptB && typeof ptB === 'object') {
        latB = ptB.lat; lonB = ptB.lon;
      } else {
        continue;
      }
      
      if (typeof latA !== 'number' || typeof lonA !== 'number' || 
          typeof latB !== 'number' || typeof lonB !== 'number' ||
          isNaN(latA) || isNaN(lonA) || isNaN(latB) || isNaN(lonB)) {
        continue;
      }
      
      const a = { lat: latA, lon: lonA };
      const b = { lat: latB, lon: lonB };
      let forbidden = false;
      let reason = '';

      // ОПТИМИЗИРОВАННАЯ проверка с bbox
      for (const bboxData of forbiddenBBoxes) {
        // Сначала быстрая проверка bbox (отсеет ~95% ненужных проверок)
        if (segmentIntersectsBBox(a, b, bboxData)) {
          // Только если bbox пересекается - делаем полную проверку
          if (segmentIntersectsPolygon(a, b, bboxData.poly)) {
            forbidden = true;
            reason = `Пересекает запретную зону`;
            break;
          }
        } else {
          bboxRejections++;
        }
      }

      // Check for intersection with barriers
      if (!forbidden && barrierObjs.length > 0) {
        const barrierCheck = segmentIntersectsBarriers(a, b, barrierObjs);
        if (barrierCheck.intersects) {
          forbidden = true;
          reason = `Пересекает барьер: ${barrierCheck.barrier}`;
        }
      }

      if (!forbidden) {
        const idxA = getOrCreateNodeIndex(a.lat, a.lon);
        const idxB = getOrCreateNodeIndex(b.lat, b.lon);

        if (idxA !== idxB) {
          edges.push([idxA, idxB]);
          edges.push([idxB, idxA]); // Undirected graph
        } else {
          excludedSegments.push({segment: [a, b], reason: `Сегмент слишком короткий или узлы слились (расстояние < ${nodeTolerance}м)`});
        }
      } else {
        excludedSegments.push({segment: [a, b], reason: reason});
      }
      
      processedSegments++;
      
      // Логируем прогресс каждые 1000 сегментов
      if (processedSegments % 1000 === 0) {
        console.log(`  ⏳ Обработано сегментов: ${processedSegments}, отсеяно по bbox: ${bboxRejections}`);
      }
    }
  });
  
  console.log(`✅ Обработано ${processedSegments} сегментов, bbox отсеял ${bboxRejections} проверок (${(bboxRejections/(processedSegments * forbiddenBBoxes.length || 1)*100).toFixed(1)}%)`);

  // Build adjacency list
  console.log('🔨 Построение списка смежности...');
  const adj = Array(nodes.length).fill(0).map(() => []);
  const edgeSet = new Set();
  
  edges.forEach(([u, v]) => {
    const key1 = `${u}-${v}`;
    const key2 = `${v}-${u}`;
    if (!edgeSet.has(key1)) {
      adj[u].push(v);
      adj[v].push(u);
      edgeSet.add(key1);
      edgeSet.add(key2);
    }
  });

  console.log(`✅ Граф построен: ${nodes.length} узлов, ${edges.length/2} рёбер, ${excludedSegments.length} исключено`);

  return {nodes, adj, excludedSegments};
}

// BFS для проверки достижимости
export function isReachable(graph, fromIdx, toIdx) {
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

// Класс для эффективной приоритетной очереди (min-heap)
class MinHeap {
  constructor() {
    this.heap = [];
  }
  
  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }
  
  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();
    
    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._bubbleDown(0);
    return min;
  }
  
  get length() {
    return this.heap.length;
  }
  
  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index][0] >= this.heap[parentIndex][0]) break;
      
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }
  
  _bubbleDown(index) {
    const length = this.heap.length;
    while (true) {
      let minIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      
      if (leftChild < length && this.heap[leftChild][0] < this.heap[minIndex][0]) {
        minIndex = leftChild;
      }
      if (rightChild < length && this.heap[rightChild][0] < this.heap[minIndex][0]) {
        minIndex = rightChild;
      }
      
      if (minIndex === index) break;
      
      [this.heap[index], this.heap[minIndex]] = [this.heap[minIndex], this.heap[index]];
      index = minIndex;
    }
  }
}

// Оптимизированный алгоритм Дейкстры с эффективной приоритетной очередью
export function dijkstra(graph, startIdx, endIdx) {
  const dist = Array(graph.nodes.length).fill(Infinity);
  const prev = Array(graph.nodes.length).fill(null);
  const visited = new Set();
  dist[startIdx] = 0;
  
  // Приоритетная очередь: [distance, nodeIndex]
  const pq = new MinHeap();
  pq.push([0, startIdx]);
  
  while (pq.length > 0) {
    // Извлекаем узел с минимальным расстоянием
    const [currentDist, u] = pq.pop();
    
    // Если уже посетили этот узел, пропускаем
    if (visited.has(u)) continue;
    visited.add(u);
    
    // Если достигли цели, можно остановиться
    if (u === endIdx) break;
    
    // Обрабатываем соседей
    for (const v of graph.adj[u]) {
      if (visited.has(v)) continue;
      
      const d = haversine(graph.nodes[u].lat, graph.nodes[u].lon, graph.nodes[v].lat, graph.nodes[v].lon);
      const newDist = dist[u] + d;
      
      if (newDist < dist[v]) {
        dist[v] = newDist;
        prev[v] = u;
        pq.push([newDist, v]);
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

// Оптимизированный поиск ближайшего узла с пространственным индексированием
export function findNearestNodeIdx(lat, lon, nodes) {
  // Проверяем валидность входных параметров
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return -1;
  }
  
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return -1;
  }
  
  let minDist = Infinity;
  let nearestIdx = -1;
  
  // Быстрая проверка: сначала ищем в радиусе 100м
  const searchRadius = 100; // метров
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node.lat !== 'number' || typeof node.lon !== 'number') {
      continue;
    }
    
    // Быстрая оценка расстояния (приблизительная)
    const latDiff = Math.abs(lat - node.lat);
    const lonDiff = Math.abs(lon - node.lon);
    const roughDist = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111000; // ~111км на градус
    
    // Если грубая оценка больше радиуса поиска, пропускаем точный расчет
    if (roughDist > searchRadius && minDist < Infinity) {
      continue;
    }
    
    const dist = haversine(lat, lon, node.lat, node.lon);
    if (dist < minDist) {
      minDist = dist;
      nearestIdx = i;
    }
  }
  return nearestIdx;
} 