/**
 * Модуль управления последовательностью взятия точек
 * Реализует алгоритмы оптимизации маршрута и управление порядком точек
 */

import { haversine } from './utils.js';
import { pointMarkers, getStartPoint } from './mapModule.js';
import { dijkstra, findNearestNodeIdx } from './algorithms.js';

// Текущая последовательность точек (массив индексов)
let currentSequence = [];
let isClockwise = true; // Направление маршрута

// Глобальное хранилище графа троп
let trailGraph = null;

/**
 * Установка графа троп для использования в оптимизации
 * @param {Object} graph - Граф троп {nodes, adj}
 */
export function setTrailGraph(graph) {
  trailGraph = graph;
  console.log(`📊 Граф троп сохранен для оптимизации маршрута: ${graph?.nodes?.length || 0} узлов`);
}

/**
 * Вычисление расстояния между двумя точками с учетом графа троп
 * @param {Object} from - Координаты начальной точки {lat, lng}
 * @param {Object} to - Координаты конечной точки {lat, lng}
 * @returns {number} - Расстояние по тропам (или по прямой, если граф недоступен)
 */
function calculatePathDistance(from, to) {
  // Если графа нет, используем прямое расстояние
  if (!trailGraph || !trailGraph.nodes || trailGraph.nodes.length === 0) {
    return haversine(from.lat, from.lng, to.lat, to.lng);
  }
  
  // Находим ближайшие узлы графа к обеим точкам
  const fromNodeIdx = findNearestNodeIdx(from.lat, from.lng, trailGraph.nodes);
  const toNodeIdx = findNearestNodeIdx(to.lat, to.lng, trailGraph.nodes);
  
  if (fromNodeIdx === -1 || toNodeIdx === -1) {
    // Если не нашли узлы, используем прямое расстояние
    return haversine(from.lat, from.lng, to.lat, to.lng);
  }
  
  // Используем алгоритм Дейкстры для поиска кратчайшего пути по графу
  const result = dijkstra(trailGraph, fromNodeIdx, toNodeIdx);
  
  // Если путь найден, возвращаем расстояние по графу
  if (result.distance < Infinity) {
    return result.distance;
  }
  
  // Если пути нет (точки не связаны), используем прямое расстояние * штраф
  // Штраф нужен, чтобы алгоритм предпочитал связанные точки
  return haversine(from.lat, from.lng, to.lat, to.lng) * 10;
}

/**
 * Построение оптимальной последовательности точек улучшенным алгоритмом
 * @param {Array} points - Массив маркеров точек
 * @param {Object} startPoint - Точка старта {lat, lng}
 * @param {boolean} clockwise - Направление обхода
 * @returns {Array} - Массив индексов в оптимальном порядке
 */
export function buildOptimalSequence(points, startPoint, clockwise = true) {
  if (!points || points.length === 0) {
    return [];
  }

  const numPoints = points.length;
  
  console.log(`🎯 Начинаем построение оптимальной последовательности для ${numPoints} точек`);
  
  // Для малого количества точек используем простой алгоритм
  if (numPoints <= 3) {
    return buildSimpleSequence(points, startPoint, clockwise);
  }
  
  // Пробуем несколько алгоритмов и выбираем лучший
  const algorithms = [
    () => buildNearestNeighborSequence(points, startPoint),
    () => buildConvexHullSequence(points, startPoint),
    () => buildSpiralSequence(points, startPoint)
  ];
  
  let bestSequence = [];
  let bestDistance = Infinity;
  
  for (let i = 0; i < algorithms.length; i++) {
    try {
      const sequence = algorithms[i]();
      const distance = calculateSequenceDistance(sequence, points, startPoint);
      
      console.log(`📊 Алгоритм ${i + 1}: расстояние ${(distance / 1000).toFixed(2)} км`);
      
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSequence = sequence;
      }
    } catch (error) {
      console.warn(`⚠️ Алгоритм ${i + 1} не сработал:`, error);
    }
  }
  
  console.log(`✅ Выбран лучший алгоритм с расстоянием ${(bestDistance / 1000).toFixed(2)} км`);
  
  return clockwise ? bestSequence : bestSequence.reverse();
}

/**
 * Простая последовательность для малого количества точек
 */
function buildSimpleSequence(points, startPoint, clockwise) {
  const sequence = [];
  const visited = new Array(points.length).fill(false);
  let currentPos = startPoint;
  
  for (let i = 0; i < points.length; i++) {
    let nearestIdx = -1;
    let minDist = Infinity;
    
    for (let j = 0; j < points.length; j++) {
      if (!visited[j]) {
        const coords = points[j].getLatLng();
        const dist = haversine(currentPos.lat, currentPos.lng, coords.lat, coords.lng);
        
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = j;
        }
      }
    }
    
    if (nearestIdx !== -1) {
      visited[nearestIdx] = true;
      sequence.push(nearestIdx);
      currentPos = points[nearestIdx].getLatLng();
    }
  }
  
  return clockwise ? sequence : sequence.reverse();
}

/**
 * Алгоритм ближайшего соседа с улучшениями
 */
function buildNearestNeighborSequence(points, startPoint) {
  const sequence = [];
  const visited = new Array(points.length).fill(false);
  let currentPos = startPoint;
  
  for (let i = 0; i < points.length; i++) {
    let nearestIdx = -1;
    let minDist = Infinity;
    
    for (let j = 0; j < points.length; j++) {
      if (!visited[j]) {
        const coords = points[j].getLatLng();
        let dist = haversine(currentPos.lat, currentPos.lng, coords.lat, coords.lng);
        
        // Для последней точки учитываем возврат к старту
        if (i === points.length - 1) {
          const returnDist = haversine(coords.lat, coords.lng, startPoint.lat, startPoint.lng);
          dist += returnDist * 0.2; // Штраф за возврат
        }
        
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = j;
        }
      }
    }
    
    if (nearestIdx !== -1) {
      visited[nearestIdx] = true;
      sequence.push(nearestIdx);
      currentPos = points[nearestIdx].getLatLng();
    }
  }
  
  return sequence;
}

/**
 * Алгоритм на основе выпуклой оболочки
 */
function buildConvexHullSequence(points, startPoint) {
  // Находим выпуклую оболочку точек
  const hull = findConvexHull(points);
  
  // Добавляем внутренние точки к ближайшим точкам оболочки
  const sequence = [...hull];
  const visited = new Set(hull);
  
  // Добавляем оставшиеся точки
  for (let i = 0; i < points.length; i++) {
    if (!visited.has(i)) {
      // Находим ближайшую точку оболочки
      let nearestHullIdx = hull[0];
      let minDist = Infinity;
      
      for (let hullIdx of hull) {
        const coords1 = points[i].getLatLng();
        const coords2 = points[hullIdx].getLatLng();
        const dist = haversine(coords1.lat, coords1.lng, coords2.lat, coords2.lng);
        
        if (dist < minDist) {
          minDist = dist;
          nearestHullIdx = hullIdx;
        }
      }
      
      // Вставляем точку после ближайшей точки оболочки
      const insertIndex = sequence.indexOf(nearestHullIdx) + 1;
      sequence.splice(insertIndex, 0, i);
    }
  }
  
  return sequence;
}

/**
 * Спиральный алгоритм (от центра наружу)
 */
function buildSpiralSequence(points, startPoint) {
  // Сортируем точки по расстоянию от старта
  const pointsWithDist = points.map((point, idx) => ({
    idx,
    coords: point.getLatLng(),
    dist: haversine(startPoint.lat, startPoint.lng, point.getLatLng().lat, point.getLatLng().lng)
  }));
  
  pointsWithDist.sort((a, b) => a.dist - b.dist);
  
  // Создаем спиральную последовательность
  const sequence = [];
  const visited = new Set();
  
  // Начинаем с ближайших точек
  for (let i = 0; i < pointsWithDist.length; i++) {
    const point = pointsWithDist[i];
    if (!visited.has(point.idx)) {
      sequence.push(point.idx);
      visited.add(point.idx);
    }
  }
  
  return sequence;
}

/**
 * Поиск выпуклой оболочки (алгоритм Грэхема)
 */
function findConvexHull(points) {
  if (points.length < 3) {
    return points.map((_, idx) => idx);
  }
  
  // Находим самую нижнюю точку (с минимальной широтой)
  let bottomIdx = 0;
  for (let i = 1; i < points.length; i++) {
    const coords = points[i].getLatLng();
    const bottomCoords = points[bottomIdx].getLatLng();
    if (coords.lat < bottomCoords.lat || 
        (coords.lat === bottomCoords.lat && coords.lng < bottomCoords.lng)) {
      bottomIdx = i;
    }
  }
  
  // Сортируем точки по полярному углу относительно нижней точки
  const bottomCoords = points[bottomIdx].getLatLng();
  const sortedPoints = points.map((point, idx) => ({
    idx,
    coords: point.getLatLng(),
    angle: Math.atan2(
      point.getLatLng().lat - bottomCoords.lat,
      point.getLatLng().lng - bottomCoords.lng
    )
  })).sort((a, b) => a.angle - b.angle);
  
  // Строим выпуклую оболочку
  const hull = [sortedPoints[0].idx];
  
  for (let i = 1; i < sortedPoints.length; i++) {
    const current = sortedPoints[i];
    
    // Удаляем точки, которые не образуют выпуклый угол
    while (hull.length > 1 && 
           crossProduct(
             points[hull[hull.length - 2]].getLatLng(),
             points[hull[hull.length - 1]].getLatLng(),
             current.coords
           ) <= 0) {
      hull.pop();
    }
    
    hull.push(current.idx);
  }
  
  return hull;
}

/**
 * Векторное произведение для определения направления поворота
 */
function crossProduct(p1, p2, p3) {
  return (p2.lng - p1.lng) * (p3.lat - p1.lat) - (p2.lat - p1.lat) * (p3.lng - p1.lng);
}

/**
 * Расчет расстояния последовательности
 */
function calculateSequenceDistance(sequence, points, startPoint) {
  let totalDist = 0;
  let prevPos = startPoint;
  
  for (let idx of sequence) {
    const coords = points[idx].getLatLng();
    totalDist += haversine(prevPos.lat, prevPos.lng, coords.lat, coords.lng);
    prevPos = coords;
  }
  
  // Добавляем возврат к старту
  totalDist += haversine(prevPos.lat, prevPos.lng, startPoint.lat, startPoint.lng);
  return totalDist;
}


/**
 * Настоящая 2-opt оптимизация с проверкой всех пересечений
 * @param {Array} sequence - Исходная последовательность
 * @param {Array} points - Массив маркеров точек
 * @param {Object} startPoint - Точка старта
 * @returns {Array} - Улучшенная последовательность
 */
export function optimizeSequenceWith2Opt(sequence, points, startPoint) {
  if (sequence.length < 4) {
    return sequence;
  }
  
  let route = [...sequence];
  const initialDistance = calculateTotalRouteDistance(route, points, startPoint);
  
  console.log(`🔧 Начинаем 2-opt оптимизацию. Начальное расстояние: ${(initialDistance / 1000).toFixed(2)} км`);
  
  let improved = true;
  let iteration = 0;
  const maxIterations = 1000; // Больше итераций для лучшего результата
  
  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;
    
    // Проверяем ВСЕ возможные пары ребер
    for (let i = 0; i < route.length - 1; i++) {
      for (let k = i + 2; k < route.length; k++) {
        // Получаем координаты для проверки пересечения
        const i_prev = i === 0 ? startPoint : points[route[i - 1]].getLatLng();
        const i_curr = points[route[i]].getLatLng();
        const k_curr = points[route[k]].getLatLng();
        const k_next = k === route.length - 1 ? startPoint : points[route[k + 1]].getLatLng();
        
        // Вычисляем текущее расстояние для этих двух ребер
        const currentDist = haversine(i_prev.lat, i_prev.lng, i_curr.lat, i_curr.lng) +
                           haversine(k_curr.lat, k_curr.lng, k_next.lat, k_next.lng);
        
        // Вычисляем новое расстояние при развороте сегмента
        const newDist = haversine(i_prev.lat, i_prev.lng, k_curr.lat, k_curr.lng) +
                       haversine(i_curr.lat, i_curr.lng, k_next.lat, k_next.lng);
        
        // Если новый вариант лучше - применяем
        if (newDist < currentDist - 0.01) { // Небольшой порог для избежания флуктуаций
          // Разворачиваем сегмент между i и k
          const newRoute = [
            ...route.slice(0, i),
            ...route.slice(i, k + 1).reverse(),
            ...route.slice(k + 1)
          ];
          
          route = newRoute;
          improved = true;
          
          const improvement = currentDist - newDist;
          if (iteration % 10 === 0 || improvement > 100) {
            console.log(`✅ Итерация ${iteration}: улучшение ${(improvement / 1000).toFixed(3)} км`);
          }
          
          // Начинаем заново после каждого улучшения
          break;
        }
      }
      
      if (improved) break; // Начинаем заново
    }
  }
  
  const finalDistance = calculateTotalRouteDistance(route, points, startPoint);
  const totalImprovement = initialDistance - finalDistance;
  
  console.log(`🔧 2-opt завершена: ${iteration} итераций`);
  console.log(`📊 Финальное расстояние: ${(finalDistance / 1000).toFixed(2)} км`);
  console.log(`💡 Общее улучшение: ${(totalImprovement / 1000).toFixed(2)} км (${((totalImprovement / initialDistance) * 100).toFixed(1)}%)`);
  
  return route;
}

/**
 * Расчет полного расстояния циклического маршрута
 */
function calculateTotalRouteDistance(sequence, points, startPoint) {
  let totalDist = 0;
  let prevPos = startPoint;
  
  for (let idx of sequence) {
    const coords = points[idx].getLatLng();
    totalDist += calculatePathDistance(prevPos, coords);
    prevPos = coords;
  }
  
  // Добавляем возврат к старту
  totalDist += calculatePathDistance(prevPos, startPoint);
  return totalDist;
}

/**
 * Генерация оптимальной последовательности для текущих точек
 */
export function generateOptimalSequence() {
  const startPoint = getStartPoint();
  
  if (!startPoint) {
    console.warn('Точка старта не установлена');
    return [];
  }
  
  if (!pointMarkers || pointMarkers.length === 0) {
    console.warn('Нет точек для построения маршрута');
    return [];
  }
  
  // Строим начальную последовательность
  const initialSequence = buildOptimalSequence(pointMarkers, startPoint, isClockwise);
  
  // Оптимизируем методом 2-opt
  currentSequence = optimizeSequenceWith2Opt(initialSequence, pointMarkers, startPoint);
  
  console.log(`✅ Построена оптимальная последовательность (${isClockwise ? 'по часовой' : 'против часовой'}):`, currentSequence.map(i => i + 1));
  
  return currentSequence;
}

/**
 * Переключение направления маршрута
 */
export function toggleDirection() {
  isClockwise = !isClockwise;
  
  if (currentSequence.length > 0) {
    currentSequence.reverse();
    console.log(`🔄 Направление изменено на ${isClockwise ? 'по часовой' : 'против часовой'}`);
  }
  
  return isClockwise;
}

/**
 * Ручное обновление последовательности
 * @param {Array} newSequence - Новая последовательность индексов
 */
export function updateSequence(newSequence) {
  if (!Array.isArray(newSequence)) {
    console.error('Последовательность должна быть массивом');
    return false;
  }
  
  // Проверяем валидность последовательности
  const numPoints = pointMarkers.length;
  const validSequence = newSequence.every(idx => idx >= 0 && idx < numPoints);
  
  if (!validSequence) {
    console.error('Некорректная последовательность точек');
    return false;
  }
  
  currentSequence = [...newSequence];
  console.log('✏️ Последовательность обновлена вручную:', currentSequence.map(i => i + 1));
  
  return true;
}

/**
 * Получение текущей последовательности
 */
export function getCurrentSequence() {
  return [...currentSequence];
}

/**
 * Получение следующей точки после заданной
 * @param {number} currentPointIdx - Индекс текущей точки
 * @returns {number|null} - Индекс следующей точки или null
 */
export function getNextPoint(currentPointIdx) {
  if (currentSequence.length === 0) {
    return null;
  }
  
  // Если текущая точка - старт, возвращаем первую точку последовательности
  if (currentPointIdx === -1 || currentPointIdx === null) {
    return currentSequence[0];
  }
  
  // Находим позицию текущей точки в последовательности
  const positionInSequence = currentSequence.indexOf(currentPointIdx);
  
  if (positionInSequence === -1) {
    // Точка не в последовательности - возвращаем первую
    return currentSequence[0];
  }
  
  // Если это последняя точка - возвращаем старт (null или -1)
  if (positionInSequence === currentSequence.length - 1) {
    return -1; // -1 означает возврат к старту
  }
  
  // Возвращаем следующую точку в последовательности
  return currentSequence[positionInSequence + 1];
}

/**
 * Проверка, является ли текущая точка последней в маршруте
 * @param {number} currentPointIdx - Индекс текущей точки
 * @returns {boolean}
 */
export function isLastPoint(currentPointIdx) {
  if (currentSequence.length === 0) {
    return false;
  }
  
  const positionInSequence = currentSequence.indexOf(currentPointIdx);
  return positionInSequence === currentSequence.length - 1;
}

/**
 * Получение направления маршрута
 */
export function getDirection() {
  return isClockwise;
}

/**
 * Сброс последовательности
 */
export function resetSequence() {
  currentSequence = [];
  isClockwise = true;
  console.log('🔄 Последовательность сброшена');
}

/**
 * Получение статистики маршрута с учетом графа троп
 */
export function getRouteStats() {
  if (currentSequence.length === 0) {
    return null;
  }
  
  const startPoint = getStartPoint();
  if (!startPoint) {
    return null;
  }
  
  let totalDistance = 0;
  let prevPos = startPoint;
  
  for (let idx of currentSequence) {
    const coords = pointMarkers[idx].getLatLng();
    totalDistance += calculatePathDistance(prevPos, coords);
    prevPos = coords;
  }
  
  // Добавляем расстояние возврата к старту
  totalDistance += calculatePathDistance(prevPos, startPoint);
  
  return {
    totalPoints: currentSequence.length,
    totalDistance: totalDistance,
    direction: isClockwise ? 'по часовой' : 'против часовой'
  };
}


