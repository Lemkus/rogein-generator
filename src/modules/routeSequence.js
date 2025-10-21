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
  
  // Для малого количества точек используем простой алгоритм
  if (numPoints <= 3) {
    return buildSimpleSequence(points, startPoint, clockwise);
  }
  
  // Для большего количества точек используем улучшенный алгоритм
  return buildAdvancedSequence(points, startPoint, clockwise);
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
 * Улучшенный алгоритм для большого количества точек
 */
function buildAdvancedSequence(points, startPoint, clockwise) {
  // Создаем матрицу расстояний для всех точек
  const distanceMatrix = createDistanceMatrix(points, startPoint);
  
  // Используем улучшенный жадный алгоритм с учетом возврата к старту
  const sequence = greedyWithReturnOptimization(distanceMatrix, points.length);
  
  // Применяем направление
  return clockwise ? sequence : sequence.reverse();
}

/**
 * Создание матрицы расстояний между всеми точками
 */
function createDistanceMatrix(points, startPoint) {
  const n = points.length;
  const matrix = Array(n + 1).fill().map(() => Array(n + 1).fill(0));
  
  // Заполняем расстояния от старта к точкам
  for (let i = 0; i < n; i++) {
    const coords = points[i].getLatLng();
    matrix[0][i + 1] = calculatePathDistance(startPoint, coords);
    matrix[i + 1][0] = matrix[0][i + 1]; // Симметричная матрица
  }
  
  // Заполняем расстояния между точками
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const coords1 = points[i].getLatLng();
      const coords2 = points[j].getLatLng();
      const dist = calculatePathDistance(coords1, coords2);
      matrix[i + 1][j + 1] = dist;
      matrix[j + 1][i + 1] = dist; // Симметричная матрица
    }
  }
  
  return matrix;
}

/**
 * Улучшенный жадный алгоритм с учетом возврата к старту
 */
function greedyWithReturnOptimization(distanceMatrix, numPoints) {
  const sequence = [];
  const visited = new Array(numPoints).fill(false);
  let currentIdx = 0; // Начинаем от старта (индекс 0 в матрице)
  
  for (let i = 0; i < numPoints; i++) {
    let bestIdx = -1;
    let minCost = Infinity;
    
    // Ищем лучшую следующую точку
    for (let j = 1; j <= numPoints; j++) { // j=1..n (точки, j=0 это старт)
      if (!visited[j - 1]) {
        let cost = distanceMatrix[currentIdx][j];
        
        // Для последней точки добавляем стоимость возврата к старту
        if (i === numPoints - 1) {
          cost += distanceMatrix[j][0];
        }
        
        if (cost < minCost) {
          minCost = cost;
          bestIdx = j;
        }
      }
    }
    
    if (bestIdx !== -1) {
      sequence.push(bestIdx - 1); // Преобразуем обратно в индекс точки
      visited[bestIdx - 1] = true;
      currentIdx = bestIdx;
    }
  }
  
  return sequence;
}

/**
 * Улучшенная оптимизация последовательности методом 2-opt с лучшим алгоритмом
 * @param {Array} sequence - Исходная последовательность
 * @param {Array} points - Массив маркеров точек
 * @param {Object} startPoint - Точка старта
 * @returns {Array} - Улучшенная последовательность
 */
export function optimizeSequenceWith2Opt(sequence, points, startPoint) {
  if (sequence.length < 4) {
    return sequence; // Для маленьких маршрутов оптимизация не нужна
  }
  
  let currentSequence = [...sequence];
  let bestSequence = [...sequence];
  let bestDistance = calculateTotalRouteDistance(sequence, points, startPoint);
  
  console.log(`🔧 Начинаем 2-opt оптимизацию. Начальное расстояние: ${(bestDistance / 1000).toFixed(2)} км`);
  
  // Улучшенный 2-opt с множественными попытками
  const maxIterations = Math.min(100, sequence.length * 3);
  let iteration = 0;
  let improved = true;
  
  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;
    
    // Ищем лучшее улучшение в текущей итерации
    let bestImprovement = 0;
    let bestI = -1, bestJ = -1;
    
    // Проверяем все возможные перестановки
    for (let i = 0; i < currentSequence.length - 1; i++) {
      for (let j = i + 2; j < currentSequence.length; j++) {
        const improvement = calculateSwapImprovement(currentSequence, i, j, points, startPoint);
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestI = i;
          bestJ = j;
        }
      }
    }
    
    // Применяем лучшее улучшение
    if (bestImprovement > 0) {
      const newSequence = [
        ...currentSequence.slice(0, bestI + 1),
        ...currentSequence.slice(bestI + 1, bestJ + 1).reverse(),
        ...currentSequence.slice(bestJ + 1)
      ];
      
      const newDistance = calculateTotalRouteDistance(newSequence, points, startPoint);
      
      if (newDistance < bestDistance) {
        currentSequence = newSequence;
        bestSequence = [...newSequence];
        bestDistance = newDistance;
        improved = true;
        
        console.log(`✅ Итерация ${iteration}: улучшение на ${(bestImprovement / 1000).toFixed(2)} км`);
      }
    }
  }
  
  const finalDistance = calculateTotalRouteDistance(bestSequence, points, startPoint);
  const totalImprovement = calculateTotalRouteDistance(sequence, points, startPoint) - finalDistance;
  
  console.log(`🔧 2-opt завершена: ${iteration} итераций`);
  console.log(`📊 Финальное расстояние: ${(finalDistance / 1000).toFixed(2)} км`);
  console.log(`💡 Общее улучшение: ${(totalImprovement / 1000).toFixed(2)} км (${((totalImprovement / calculateTotalRouteDistance(sequence, points, startPoint)) * 100).toFixed(1)}%)`);
  
  return bestSequence;
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
 * Расчет улучшения при 2-opt перестановке
 */
function calculateSwapImprovement(sequence, i, j, points, startPoint) {
  if (i >= j - 1) return 0;
  
  // Получаем координаты точек
  const prevI = i === 0 ? startPoint : points[sequence[i - 1]].getLatLng();
  const currI = points[sequence[i]].getLatLng();
  const currJ = points[sequence[j]].getLatLng();
  const nextJ = j === sequence.length - 1 ? startPoint : points[sequence[j + 1]].getLatLng();
  
  // Старое расстояние: prevI -> currI -> ... -> currJ -> nextJ
  const oldDist = calculatePathDistance(prevI, currI) + calculatePathDistance(currJ, nextJ);
  
  // Новое расстояние: prevI -> currJ -> ... -> currI -> nextJ
  const newDist = calculatePathDistance(prevI, currJ) + calculatePathDistance(currI, nextJ);
  
  return oldDist - newDist; // Положительное значение = улучшение
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

