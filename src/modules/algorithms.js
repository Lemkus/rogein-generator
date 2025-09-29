/**
 * Модуль алгоритмов для работы с графами и геометрией
 * Включает построение графа троп, алгоритм Дейкстры и проверки пересечений
 */

import { haversine, segmentIntersectsPolygon, segmentsIntersect, extractPolygons, distancePointToSegment } from './utils.js';

// Функция для проверки пересечения отрезка с барьерами
export function segmentIntersectsBarriers(p1, p2, barrierObjs) {
  for (const barrier of barrierObjs) {
    if (barrier.type === 'way' && barrier.geometry && barrier.geometry.length > 1) {
      // Проверяем пересечение со всеми сегментами барьера-линии
      for (let i = 0; i < barrier.geometry.length - 1; i++) {
        const b1 = barrier.geometry[i];
        const b2 = barrier.geometry[i + 1];
        if (segmentsIntersect(p1, p2, b1, b2)) {
          return {
            intersects: true,
            barrier: `Way ${barrier.id || 'unknown'} (${barrier.tags ? Object.keys(barrier.tags).join(', ') : 'no tags'})`
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
          barrier: `Node ${barrier.id || 'unknown'} (${barrier.tags ? Object.keys(barrier.tags).join(', ') : 'no tags'})`
        };
      }
    }
  }
  return { intersects: false };
}

// Построение графа троп с удалением рёбер, пересекающих запрещённые зоны
export function buildPathGraph(paths, forbiddenPolygons, barrierObjs = []) {
  const nodes = []; // Stores {lat, lon} objects for graph nodes
  const edges = [];
  const nodeTolerance = 0.5; // Meters. Nodes within this distance are considered the same.
  const excludedSegments = [];

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
      let lat, lon;
      
      // Проверяем формат точки
      if (Array.isArray(pt)) {
        // Формат массива [lat, lon]
        lat = pt[0];
        lon = pt[1];
      } else if (pt && typeof pt === 'object') {
        // Формат объекта {lat, lon}
        lat = pt.lat;
        lon = pt.lon;
      } else {
        console.log(`🔍 Неизвестный формат точки:`, pt);
        return;
      }
      
      // Проверяем валидность координат
      if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        console.log(`🔍 Невалидные координаты:`, { lat, lon, original: pt });
        return;
      }
      
      getOrCreateNodeIndex(lat, lon);
    });
  });

  // Add edges between neighboring points of each path if they don't intersect forbidden areas or barriers
  paths.forEach(path => {
    if (!path.geometry || path.geometry.length < 2) return;
    for (let i = 0; i < path.geometry.length - 1; i++) {
      const ptA = path.geometry[i];
      const ptB = path.geometry[i+1];
      
      // Извлекаем координаты из точек
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
      
      // Проверяем валидность координат
      if (typeof latA !== 'number' || typeof lonA !== 'number' || 
          typeof latB !== 'number' || typeof lonB !== 'number' ||
          isNaN(latA) || isNaN(lonA) || isNaN(latB) || isNaN(lonB)) {
        continue;
      }
      
      const a = { lat: latA, lon: lonA };
      const b = { lat: latB, lon: lonB };
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
          excludedSegments.push({segment: [a, b], reason: `Сегмент слишком короткий или узлы слились (расстояние < ${nodeTolerance}м)`});
        }
      } else {
        excludedSegments.push({segment: [a, b], reason: reason});
      }
    }
  });

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

// Алгоритм Дейкстры для поиска кратчайшего пути в графе
export function dijkstra(graph, startIdx, endIdx) {
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

// Поиск ближайшего узла в графе к заданной точке
export function findNearestNodeIdx(lat, lon, nodes) {
  let minDist = Infinity;
  let nearestIdx = -1;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node.lat !== 'number' || typeof node.lon !== 'number') {
      continue; // Пропускаем невалидные узлы
    }
    
    const dist = haversine(lat, lon, node.lat, node.lon);
    if (dist < minDist) {
      minDist = dist;
      nearestIdx = i;
    }
  }
  return nearestIdx;
} 