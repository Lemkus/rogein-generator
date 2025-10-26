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
 * Предварительный расчет матрицы расстояний между всеми точками
 * @param {Array} points - Массив маркеров точек
 * @param {Object} startPoint - Точка старта
 * @returns {Map} - Кэш расстояний
 */
function precalculateDistanceMatrix(points, startPoint) {
  const distanceCache = new Map();
  const allCoords = [startPoint, ...points.map(m => m.getLatLng())];
  
  // Рассчитываем расстояния между всеми парами точек
  for (let i = 0; i < allCoords.length; i++) {
    for (let j = i + 1; j < allCoords.length; j++) {
      const from = allCoords[i];
      const to = allCoords[j];
      
      const dist = calculatePathDistance(from, to);
      
      // Сохраняем в обе стороны (симметрично)
      const key1 = `${from.lat},${from.lng}-${to.lat},${to.lng}`;
      const key2 = `${to.lat},${to.lng}-${from.lat},${from.lng}`;
      distanceCache.set(key1, dist);
      distanceCache.set(key2, dist);
    }
  }
  
  return distanceCache;
}

/**
 * Построение последовательности методом ближайшего соседа с заданной стартовой точкой
 * @param {Array} points - Массив маркеров точек
 * @param {Object} startPoint - Точка старта {lat, lng}
 * @param {number} firstPointIdx - Индекс первой точки (или -1 для автоподбора)
 * @param {Map} distanceCache - Предрассчитанная матрица расстояний
 * @returns {Array} - Массив индексов в порядке обхода
 */
function buildNearestNeighborSequence(points, startPoint, firstPointIdx, distanceCache) {
  const numPoints = points.length;
  const visited = new Array(numPoints).fill(false);
  const sequence = [];
  
  // Функция для получения расстояния из кэша
  const getDistance = (from, to) => {
    const key = `${from.lat},${from.lng}-${to.lat},${to.lng}`;
    return distanceCache.get(key) || Infinity;
  };
  
  // Если указана первая точка, начинаем с нее
  let currentPos = startPoint;
  if (firstPointIdx !== -1) {
    sequence.push(firstPointIdx);
    visited[firstPointIdx] = true;
    currentPos = points[firstPointIdx].getLatLng();
  }
  
  // Жадный алгоритм ближайшего соседа
  while (sequence.length < numPoints) {
    let nearestIdx = -1;
    let minDist = Infinity;
    
    for (let j = 0; j < numPoints; j++) {
      if (!visited[j]) {
        const coords = points[j].getLatLng();
        const dist = getDistance(currentPos, coords);
        
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
    } else {
      break; // Не должно происходить, но на всякий случай
    }
  }
  
  return sequence;
}

/**
 * Расчет общей длины маршрута
 */
function calculateTotalDistance(sequence, points, startPoint, distanceCache) {
  if (sequence.length === 0) return Infinity;
  
  const getDistance = (from, to) => {
    const key = `${from.lat},${from.lng}-${to.lat},${to.lng}`;
    return distanceCache.get(key) || Infinity;
  };
  
  let totalDist = 0;
  let prevPos = startPoint;
  
  for (const idx of sequence) {
    const currPos = points[idx].getLatLng();
    totalDist += getDistance(prevPos, currPos);
    prevPos = currPos;
  }
  
  // Возврат к старту
  totalDist += getDistance(prevPos, startPoint);
  
  return totalDist;
}

/**
 * Построение оптимальной последовательности с использованием множественных стартовых стратегий
 * @param {Array} points - Массив маркеров точек
 * @param {Object} startPoint - Точка старта {lat, lng}
 * @param {boolean} clockwise - Направление обхода
 * @param {Map} distanceCache - Предрассчитанная матрица расстояний
 * @returns {Array} - Массив индексов в оптимальном порядке
 */
export function buildOptimalSequence(points, startPoint, clockwise = true, distanceCache = null) {
  if (!points || points.length === 0) {
    return [];
  }

  const numPoints = points.length;
  
  // Стратегия 1: Начинаем с ближайшей точки к старту
  const seq1 = buildNearestNeighborSequence(points, startPoint, -1, distanceCache);
  let bestSequence = seq1;
  let bestDistance = calculateTotalDistance(seq1, points, startPoint, distanceCache);
  
  console.log(`📍 Стратегия 1 (ближайшая к старту): ${(bestDistance / 1000).toFixed(2)} км`);
  
  // Стратегия 2-N: Начинаем с каждой точки по очереди (для маленьких маршрутов)
  if (numPoints <= 12) {
    for (let startIdx = 0; startIdx < numPoints; startIdx++) {
      const seq = buildNearestNeighborSequence(points, startPoint, startIdx, distanceCache);
      const dist = calculateTotalDistance(seq, points, startPoint, distanceCache);
      
      if (dist < bestDistance) {
        bestDistance = dist;
        bestSequence = seq;
        console.log(`📍 Стратегия с точки ${startIdx + 1}: ${(dist / 1000).toFixed(2)} км ✓ (лучше)`);
      }
    }
  } else {
    // Для больших маршрутов пробуем несколько случайных стартовых точек
    const tryCount = Math.min(numPoints, 5);
    for (let i = 0; i < tryCount; i++) {
      const startIdx = Math.floor(Math.random() * numPoints);
      const seq = buildNearestNeighborSequence(points, startPoint, startIdx, distanceCache);
      const dist = calculateTotalDistance(seq, points, startPoint, distanceCache);
      
      if (dist < bestDistance) {
        bestDistance = dist;
        bestSequence = seq;
        console.log(`📍 Стратегия с точки ${startIdx + 1}: ${(dist / 1000).toFixed(2)} км ✓ (лучше)`);
      }
    }
  }
  
  console.log(`✅ Лучшая начальная последовательность: ${(bestDistance / 1000).toFixed(2)} км`);
  
  // Применяем направление
  if (!clockwise) {
    bestSequence.reverse();
  }
  
  return bestSequence;
}

/**
 * Оптимизированное улучшение последовательности методом 2-opt
 * @param {Array} sequence - Исходная последовательность
 * @param {Array} points - Массив маркеров точек
 * @param {Object} startPoint - Точка старта
 * @param {Map} distanceCache - Предрассчитанная матрица расстояний
 * @returns {Array} - Улучшенная последовательность
 */
export function optimizeSequenceWith2Opt(sequence, points, startPoint, distanceCache = null) {
  if (sequence.length < 4) {
    return sequence; // Для маленьких маршрутов оптимизация не нужна
  }
  
  let currentSequence = [...sequence];
  
  // Функция для получения расстояния (использует предрассчитанный кэш или создает новый)
  const getCachedDistance = (from, to) => {
    const key = `${from.lat},${from.lng}-${to.lat},${to.lng}`;
    if (distanceCache && distanceCache.has(key)) {
      return distanceCache.get(key);
    }
    return calculatePathDistance(from, to);
  };
  
  // Функция быстрого расчета изменения расстояния при 2-opt swap
  const calculateSwapImprovement = (seq, i, j) => {
    if (i >= j - 1) return 0;
    
    // Получаем координаты точек
    const prevI = i === 0 ? startPoint : points[seq[i - 1]].getLatLng();
    const currI = points[seq[i]].getLatLng();
    const currJ = points[seq[j]].getLatLng();
    const nextJ = j === seq.length - 1 ? startPoint : points[seq[j + 1]].getLatLng();
    
    // Старое расстояние: prevI -> currI -> ... -> currJ -> nextJ
    const oldDist = getCachedDistance(prevI, currI) + getCachedDistance(currJ, nextJ);
    
    // Новое расстояние: prevI -> currJ -> ... -> currI -> nextJ
    const newDist = getCachedDistance(prevI, currJ) + getCachedDistance(currI, nextJ);
    
    return oldDist - newDist; // Положительное значение = улучшение
  };
  
  // Улучшенная 2-opt без пропусков
  const maxIterations = Math.min(200, sequence.length * 5); // Больше итераций
  const minImprovement = 0.5; // Минимальное улучшение в метрах
  let iteration = 0;
  let improved = true;
  let totalImprovement = 0;
  
  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;
    
    let bestImprovementThisIter = 0;
    let bestI = -1, bestJ = -1;
    
    // Проверяем ВСЕ пары без пропусков
    for (let i = 0; i < currentSequence.length - 1; i++) {
      for (let j = i + 2; j < currentSequence.length; j++) {
        const improvement = calculateSwapImprovement(currentSequence, i, j);
        if (improvement > bestImprovementThisIter) {
          bestImprovementThisIter = improvement;
          bestI = i;
          bestJ = j;
        }
      }
    }
    
    // Применяем лучшее улучшение
    if (bestImprovementThisIter > minImprovement) {
      const newSequence = [
        ...currentSequence.slice(0, bestI + 1),
        ...currentSequence.slice(bestI + 1, bestJ + 1).reverse(),
        ...currentSequence.slice(bestJ + 1)
      ];
      currentSequence = newSequence;
      totalImprovement += bestImprovementThisIter;
      improved = true;
    }
  }
  
  console.log(`🔧 2-opt оптимизация: ${iteration} итераций, улучшение: ${(totalImprovement / 1000).toFixed(2)} км`);
  
  return currentSequence;
}

/**
 * Or-opt оптимизация - перемещение сегментов из 1-3 точек
 * @param {Array} sequence - Исходная последовательность
 * @param {Array} points - Массив маркеров точек
 * @param {Object} startPoint - Точка старта
 * @param {Map} distanceCache - Предрассчитанная матрица расстояний
 * @returns {Array} - Улучшенная последовательность
 */
function optimizeSequenceWithOrOpt(sequence, points, startPoint, distanceCache) {
  if (sequence.length < 4) {
    return sequence;
  }
  
  let currentSequence = [...sequence];
  
  const getCachedDistance = (from, to) => {
    const key = `${from.lat},${from.lng}-${to.lat},${to.lng}`;
    return distanceCache?.get(key) || calculatePathDistance(from, to);
  };
  
  // Функция расчета улучшения при перемещении сегмента
  const calculateOrOptImprovement = (seq, segStart, segLen, insertPos) => {
    if (segStart === insertPos || segStart + segLen > seq.length) return 0;
    if (insertPos > segStart && insertPos <= segStart + segLen) return 0;
    
    const n = seq.length;
    
    // Координаты точек
    const getCoord = (idx) => {
      if (idx < 0) return startPoint;
      if (idx >= n) return startPoint;
      return points[seq[idx]].getLatLng();
    };
    
    // Старая конфигурация
    const beforeSeg = getCoord(segStart - 1);
    const segFirst = getCoord(segStart);
    const segLast = getCoord(segStart + segLen - 1);
    const afterSeg = getCoord(segStart + segLen);
    
    const beforeInsert = getCoord(insertPos - 1);
    const afterInsert = getCoord(insertPos);
    
    // Старое расстояние
    let oldDist = getCachedDistance(beforeSeg, segFirst);
    oldDist += getCachedDistance(segLast, afterSeg);
    
    if (insertPos < segStart) {
      oldDist += getCachedDistance(beforeInsert, afterInsert);
    } else {
      oldDist += getCachedDistance(beforeInsert, afterInsert);
    }
    
    // Новое расстояние
    let newDist = getCachedDistance(beforeSeg, afterSeg); // Убрали сегмент
    newDist += getCachedDistance(beforeInsert, segFirst); // Вставили сегмент
    newDist += getCachedDistance(segLast, afterInsert);
    
    return oldDist - newDist;
  };
  
  let improved = true;
  let totalImprovement = 0;
  const maxIterations = 50;
  let iteration = 0;
  
  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;
    
    let bestImprovement = 0;
    let bestSegStart = -1, bestSegLen = -1, bestInsertPos = -1;
    
    // Пробуем сегменты длиной 1, 2, 3
    for (let segLen = 1; segLen <= Math.min(3, currentSequence.length - 1); segLen++) {
      for (let segStart = 0; segStart < currentSequence.length - segLen + 1; segStart++) {
        // Пробуем вставить в разные позиции
        for (let insertPos = 0; insertPos <= currentSequence.length; insertPos++) {
          if (insertPos >= segStart && insertPos <= segStart + segLen) continue;
          
          const improvement = calculateOrOptImprovement(currentSequence, segStart, segLen, insertPos);
          if (improvement > bestImprovement) {
            bestImprovement = improvement;
            bestSegStart = segStart;
            bestSegLen = segLen;
            bestInsertPos = insertPos;
          }
        }
      }
    }
    
    // Применяем лучшее улучшение
    if (bestImprovement > 0.5) {
      const segment = currentSequence.slice(bestSegStart, bestSegStart + bestSegLen);
      const remaining = [
        ...currentSequence.slice(0, bestSegStart),
        ...currentSequence.slice(bestSegStart + bestSegLen)
      ];
      
      const newInsertPos = bestInsertPos > bestSegStart ? bestInsertPos - bestSegLen : bestInsertPos;
      currentSequence = [
        ...remaining.slice(0, newInsertPos),
        ...segment,
        ...remaining.slice(newInsertPos)
      ];
      
      totalImprovement += bestImprovement;
      improved = true;
    }
  }
  
  if (totalImprovement > 0) {
    console.log(`🔧 Or-opt оптимизация: ${iteration} итераций, улучшение: ${(totalImprovement / 1000).toFixed(2)} км`);
  }
  
  return currentSequence;
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
  
  console.log(`🚀 Генерация оптимальной последовательности для ${pointMarkers.length} точек...`);
  const totalStartTime = performance.now();
  
  // ОПТИМИЗАЦИЯ: Предварительный расчет всех расстояний ОДИН РАЗ
  const distanceCache = precalculateDistanceMatrix(pointMarkers, startPoint);
  
  // Строим начальную последовательность с использованием кэша (пробуем разные стартовые точки)
  const greedyStartTime = performance.now();
  const initialSequence = buildOptimalSequence(pointMarkers, startPoint, isClockwise, distanceCache);
  const greedyEndTime = performance.now();
  console.log(`🔸 Множественные стратегии выполнены за ${(greedyEndTime - greedyStartTime).toFixed(0)}мс`);
  
  // Оптимизируем методом 2-opt с использованием кэша
  const optStartTime = performance.now();
  let optimizedSequence = optimizeSequenceWith2Opt(initialSequence, pointMarkers, startPoint, distanceCache);
  const optEndTime = performance.now();
  console.log(`🔹 2-opt оптимизация выполнена за ${(optEndTime - optStartTime).toFixed(0)}мс`);
  
  // Дополнительная оптимизация методом Or-opt
  const orOptStartTime = performance.now();
  optimizedSequence = optimizeSequenceWithOrOpt(optimizedSequence, pointMarkers, startPoint, distanceCache);
  const orOptEndTime = performance.now();
  console.log(`🔹 Or-opt оптимизация выполнена за ${(orOptEndTime - orOptStartTime).toFixed(0)}мс`);
  
  currentSequence = optimizedSequence;
  
  const totalEndTime = performance.now();
  console.log(`✅ Построена оптимальная последовательность за ${(totalEndTime - totalStartTime).toFixed(0)}мс (${isClockwise ? 'по часовой' : 'против часовой'}):`, currentSequence.map(i => i + 1));
  
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
  console.log('🔍 getRouteStats: currentSequence =', currentSequence);
  console.log('🔍 getRouteStats: pointMarkers =', pointMarkers);
  
  if (currentSequence.length === 0) {
    console.warn('⚠️ getRouteStats: currentSequence пустая');
    return null;
  }
  
  const startPoint = getStartPoint();
  console.log('🔍 getRouteStats: startPoint =', startPoint);
  if (!startPoint) {
    console.warn('⚠️ getRouteStats: startPoint не найден');
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


