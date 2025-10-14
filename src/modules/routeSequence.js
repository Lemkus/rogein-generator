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
 * Построение оптимальной последовательности точек методом ближайшего соседа
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
  const visited = new Array(numPoints).fill(false);
  const sequence = [];
  
  // Начинаем от точки старта
  let currentPos = startPoint;
  
  // Жадный алгоритм ближайшего соседа с учетом графа троп
  for (let i = 0; i < numPoints; i++) {
    let nearestIdx = -1;
    let minDist = Infinity;
    
    // Находим ближайшую непосещенную точку по тропам
    for (let j = 0; j < numPoints; j++) {
      if (!visited[j]) {
        const marker = points[j];
        const coords = marker.getLatLng();
        
        // Используем расстояние по тропам вместо прямого
        const dist = calculatePathDistance(currentPos, coords);
        
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
  
  // Применяем направление (для против часовой стрелки - разворачиваем)
  if (!clockwise) {
    sequence.reverse();
  }
  
  return sequence;
}

/**
 * Улучшение последовательности методом 2-opt
 * @param {Array} sequence - Исходная последовательность
 * @param {Array} points - Массив маркеров точек
 * @param {Object} startPoint - Точка старта
 * @returns {Array} - Улучшенная последовательность
 */
export function optimizeSequenceWith2Opt(sequence, points, startPoint) {
  if (sequence.length < 4) {
    return sequence; // Для маленьких маршрутов оптимизация не нужна
  }
  
  let improved = true;
  let currentSequence = [...sequence];
  
  // Функция расчета общей длины маршрута с учетом графа троп
  const calculateTotalDistance = (seq) => {
    let total = 0;
    let prevPos = startPoint;
    
    for (let idx of seq) {
      const coords = points[idx].getLatLng();
      total += calculatePathDistance(prevPos, coords);
      prevPos = coords;
    }
    
    // Добавляем расстояние возврата к старту
    total += calculatePathDistance(prevPos, startPoint);
    return total;
  };
  
  let currentDistance = calculateTotalDistance(currentSequence);
  
  // Итерации 2-opt оптимизации
  const maxIterations = 100;
  let iteration = 0;
  
  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;
    
    for (let i = 0; i < currentSequence.length - 1; i++) {
      for (let j = i + 2; j < currentSequence.length; j++) {
        // Создаем новую последовательность с перевернутым сегментом
        const newSequence = [
          ...currentSequence.slice(0, i + 1),
          ...currentSequence.slice(i + 1, j + 1).reverse(),
          ...currentSequence.slice(j + 1)
        ];
        
        const newDistance = calculateTotalDistance(newSequence);
        
        if (newDistance < currentDistance) {
          currentSequence = newSequence;
          currentDistance = newDistance;
          improved = true;
        }
      }
    }
  }
  
  console.log(`🔧 2-opt оптимизация: ${iteration} итераций, улучшение: ${((calculateTotalDistance(sequence) - currentDistance) / 1000).toFixed(2)} км`);
  
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

