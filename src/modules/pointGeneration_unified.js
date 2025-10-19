/**
 * Модуль генерации контрольных точек на тропах
 * Объединенный модуль с простой и надежной генерацией точек
 */

import { haversine, extractPolygons, pointInPolygon, getRandomPointOnLine, segmentIntersectsPolygon } from './utils.js';
import { fetchAllMapData, clearMapDataCache } from './optimizedOverpassAPI.js';
import { showClosedAreasOnMap, showWaterAreasOnMap, showBarriersOnMap, addPointMarker, addFailedAttemptMarker, clearPointMarkers, clearFailedAttemptMarkers, getStartPoint, clearGraphDebugLayers, updateStartPointPosition, pointMarkers } from './mapModule.js';
import { buildPathGraph, findNearestNodeIdx, isReachable } from './algorithms.js';
import { updateTargetPointsList } from './navigation.js';
import { setTrailGraph } from './routeSequence.js';

// Переменные для отмены генерации
let cancelGeneration = false;

// Функция расчета площади прямоугольника в квадратных метрах
function rectangleArea(bounds) {
  const latDiff = bounds.north - bounds.south;
  const lngDiff = bounds.east - bounds.west;
  
  // Приблизительный коэффициент для перевода градусов в метры
  const latToMeters = 111000; // 1 градус широты ≈ 111 км
  const lngToMeters = 111000 * Math.cos((bounds.north + bounds.south) / 2 * Math.PI / 180);
  
  return latDiff * latToMeters * lngDiff * lngToMeters;
}

// Основная функция генерации точек
export async function generatePoints(selectedBounds, startPoint, count, statusCallback, buttonCallback, cancelCallback) {
  if (!selectedBounds) {
    statusCallback('Сначала выделите область на карте!');
    return;
  }
  if (!startPoint) {
    statusCallback('Сначала установите точку старта на карте!');
    return;
  }
  if (isNaN(count) || count < 1) {
    statusCallback('Введите корректное количество точек!');
    return;
  }

  buttonCallback(true); // Отключаем кнопку генерации
  cancelCallback(true); // Показываем кнопку отмены
  cancelGeneration = false; // Сбрасываем флаг отмены

  statusCallback('Загрузка данных OSM...');

  const sw = { lat: selectedBounds.south, lng: selectedBounds.west };
  const ne = { lat: selectedBounds.north, lng: selectedBounds.east };

  // Вычисляем площадь области и минимальное расстояние
  const area = rectangleArea(selectedBounds); // в м^2
  const minDist = Math.sqrt(area / count) * 0.8; // Упрощенная формула для минимального расстояния

  try {
    // Очищаем предыдущие точки и отладочные слои
    clearPointMarkers();
    clearFailedAttemptMarkers();
    clearGraphDebugLayers();

    // Загружаем все данные одним запросом
    const bbox = `${selectedBounds.south},${selectedBounds.west},${selectedBounds.north},${selectedBounds.east}`;
    console.log(`🎯 Выбранная область: ${bbox}`);
    const mapData = await fetchAllMapData(bbox, statusCallback);
    
    const closedAreasData = mapData.closed_areas || [];
    const waterAreasData = mapData.water_areas || [];
    const barriersData = mapData.barriers || [];
    const pathsData = mapData.paths || [];

    if (cancelGeneration) return;

    statusCallback(`✅ Данные загружены: ${pathsData.length} троп, ${closedAreasData.length} закрытых зон, ${waterAreasData.length} водоёмов, ${barriersData.length} барьеров`);

    // Показываем данные на карте
    showClosedAreasOnMap(closedAreasData);
    showWaterAreasOnMap(waterAreasData);
    showBarriersOnMap(barriersData);

    if (cancelGeneration) return;

    // Создаем граф троп
    statusCallback('Создание графа троп...');
    const graph = buildPathGraph(pathsData, [], []);
    
    if (!graph || graph.nodes.length === 0) {
      statusCallback('❌ Не найдено подходящих троп в выбранной области!');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    // Находим ближайший узел к стартовой точке
    const startNodeIdx = findNearestNodeIdx(graph, startPoint);
    if (startNodeIdx === -1) {
      statusCallback('❌ Не удалось найти ближайшую тропу к стартовой точке!');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    // Сохраняем граф для оптимизации маршрута
    setTrailGraph(graph);

    // Создаем полигоны запретных зон
    const forbiddenPolygons = [];
    
    // Добавляем закрытые зоны
    closedAreasData.forEach(area => {
      const polygons = extractPolygons(area);
      forbiddenPolygons.push(...polygons);
    });

    // Добавляем водоёмы
    waterAreasData.forEach(area => {
      const polygons = extractPolygons(area);
      forbiddenPolygons.push(...polygons);
    });

    statusCallback(`🚫 Запретных зон: ${forbiddenPolygons.length}`);

    if (cancelGeneration) return;

    // Генерируем точки
    statusCallback('Генерация точек...');
    const points = await generatePointsOnPaths(
      pathsData, 
      selectedBounds, 
      startPoint, 
      count, 
      minDist, 
      forbiddenPolygons, 
      graph, 
      startNodeIdx, 
      statusCallback
    );

    if (cancelGeneration) return;

    // Показываем результат
    if (points.length > 0) {
      statusCallback(`✅ Сгенерировано ${points.length} точек из ${count} запрошенных`);
      updateTargetPointsList(); // Обновляем список точек для навигации
    } else {
      statusCallback('❌ Не удалось сгенерировать ни одной точки. Попробуйте другую область или уменьшите количество точек.');
    }

  } catch (error) {
    console.error('Ошибка генерации точек:', error);
    statusCallback(`❌ Ошибка: ${error.message}`);
  } finally {
    buttonCallback(false);
    cancelCallback(false);
  }
}

// Генерация точек на тропах
async function generatePointsOnPaths(pathsData, selectedBounds, startPoint, count, minDist, forbiddenPolygons, graph, startNodeIdx, statusCallback) {
  const points = [];
  const maxAttempts = count * 10; // Максимальное количество попыток
  let attempts = 0;

  // Фильтруем тропы по выбранной области
  const filteredPaths = pathsData.filter(path => {
    return path.geometry && path.geometry.coordinates && path.geometry.coordinates.length > 0;
  });

  if (filteredPaths.length === 0) {
    statusCallback('❌ Не найдено подходящих троп в выбранной области!');
    return points;
  }

  statusCallback(`🎯 Генерация точек на ${filteredPaths.length} тропах...`);

  while (points.length < count && attempts < maxAttempts && !cancelGeneration) {
    attempts++;
    
    // Выбираем случайную тропу
    const randomPath = filteredPaths[Math.floor(Math.random() * filteredPaths.length)];
    const coordinates = randomPath.geometry.coordinates;
    
    if (coordinates.length < 2) continue;

    // Выбираем случайную точку на тропе
    const randomPoint = getRandomPointOnLine(coordinates);
    
    if (!randomPoint) continue;

    // Проверяем, что точка в выбранной области
    if (randomPoint.lat < selectedBounds.south || randomPoint.lat > selectedBounds.north ||
        randomPoint.lng < selectedBounds.west || randomPoint.lng > selectedBounds.east) {
      continue;
    }

    // Проверяем минимальное расстояние от других точек
    let tooClose = false;
    for (const existingPoint of points) {
      const distance = haversine(randomPoint.lat, randomPoint.lng, existingPoint.lat, existingPoint.lng);
      if (distance < minDist) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) continue;

    // Проверяем, что точка не в запретной зоне
    let inForbiddenZone = false;
    for (const polygon of forbiddenPolygons) {
      if (pointInPolygon(randomPoint, polygon)) {
        inForbiddenZone = true;
        break;
      }
    }

    if (inForbiddenZone) continue;

    // Проверяем достижимость от стартовой точки
    const pointNodeIdx = findNearestNodeIdx(graph, randomPoint);
    if (pointNodeIdx === -1) continue;

    if (!isReachable(graph, startNodeIdx, pointNodeIdx)) {
      addFailedAttemptMarker(randomPoint, 'Недостижимо');
      continue;
    }

    // Добавляем точку
    points.push(randomPoint);
    addPointMarker(randomPoint, points.length);
    
    // Обновляем статус каждые 5 точек
    if (points.length % 5 === 0) {
      statusCallback(`🎯 Сгенерировано ${points.length}/${count} точек...`);
    }
  }

  return points;
}

// Функция отмены генерации
export function cancelPointGeneration() {
  cancelGeneration = true;
}

// Функция для скачивания GPX файла
export function downloadGPX() {
  const startPoint = getStartPoint();
  
  if (pointMarkers.length === 0) {
    alert('Сначала сгенерируйте точки!');
    return;
  }

  let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailPointsGenerator" xmlns="http://www.topografix.com/GPX/1/1">
`;

  // Добавляем стартовую точку, если есть
  if (startPoint) {
    gpxContent += `  <wpt lat="${startPoint.lat.toFixed(14)}" lon="${startPoint.lng.toFixed(14)}">
    <ele>0.0</ele>
    <name>START</name>
    <type>MILE MARKER</type>
  </wpt>
`;
  }

  // Добавляем все точки
  pointMarkers.forEach((marker, i) => {
    const latlng = marker.getLatLng();
    const pointNumber = (i + 1).toString().padStart(2, '0');
    gpxContent += `  <wpt lat="${latlng.lat.toFixed(14)}" lon="${latlng.lng.toFixed(14)}">
    <ele>0.0</ele>
    <name>POINT_${pointNumber}</name>
    <type>MILE MARKER</type>
  </wpt>
`;
  });

  gpxContent += `</gpx>`;

  // Создаем и скачиваем файл
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trail_points_${new Date().toISOString().split('T')[0]}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
