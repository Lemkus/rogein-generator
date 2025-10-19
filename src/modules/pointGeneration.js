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

    // Отладочная информация о загруженных данных
    console.log('🔍 Отладочная информация загруженных данных:');
    console.log(`   Тропы: ${pathsData.length}`);
    console.log(`   Закрытые зоны: ${closedAreasData.length}`);
    console.log(`   Водоёмы: ${waterAreasData.length}`);
    console.log(`   Барьеры: ${barriersData.length}`);
    console.log(`   Выбранная область:`, selectedBounds);
    console.log(`   Стартовая точка:`, startPoint);

    // Показываем данные на карте
    showClosedAreasOnMap(closedAreasData);
    showWaterAreasOnMap(waterAreasData);
    showBarriersOnMap(barriersData);

    if (cancelGeneration) return;

    // Создаем граф троп
    statusCallback('Создание графа троп...');
    const graph = buildPathGraph(pathsData, [], barriersData);
    
    console.log('🔍 Информация о графе:');
    console.log(`   Узлы: ${graph ? graph.nodes.length : 0}`);
    console.log(`   Рёбра: ${graph ? graph.adj.length : 0}`);
    console.log(`   Исключённые сегменты: ${graph ? graph.excludedSegments.length : 0}`);
    
    if (!graph || graph.nodes.length === 0) {
      statusCallback('❌ Не найдено подходящих троп в выбранной области!');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    // Находим ближайший узел к стартовой точке
    const startNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, graph.nodes);
    if (startNodeIdx === -1) {
      statusCallback('❌ Не удалось найти ближайшую тропу к стартовой точке!');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    // Сохраняем граф для оптимизации маршрута (будет обновлен позже)
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

    // Пересоздаем граф с учетом запретных зон
    statusCallback('Обновление графа с запретными зонами...');
    const updatedGraph = buildPathGraph(pathsData, forbiddenPolygons, barriersData);
    
    // Обновляем граф для оптимизации маршрута
    setTrailGraph(updatedGraph);
    
    // Генерируем точки
    statusCallback('Генерация точек...');
    const points = await generatePointsOnPaths(
      pathsData, 
      selectedBounds, 
      startPoint, 
      count, 
      minDist, 
      forbiddenPolygons, 
      updatedGraph, 
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

  let debugStats = {
    totalAttempts: 0,
    invalidPath: 0,
    noRandomPoint: 0,
    outOfBounds: 0,
    tooClose: 0,
    inForbiddenZone: 0,
    noNearestNode: 0,
    notReachable: 0,
    success: 0
  };

  while (points.length < count && attempts < maxAttempts && !cancelGeneration) {
    attempts++;
    debugStats.totalAttempts++;
    
    // Выбираем случайную тропу
    const randomPath = filteredPaths[Math.floor(Math.random() * filteredPaths.length)];
    const coordinates = randomPath.geometry.coordinates;
    
    if (coordinates.length < 2) {
      debugStats.invalidPath++;
      continue;
    }

    // Выбираем случайную точку на тропе
    const randomPoint = getRandomPointOnLine(coordinates);
    
    if (!randomPoint) {
      debugStats.noRandomPoint++;
      continue;
    }

    // Проверяем, что точка в выбранной области
    if (randomPoint.lat < selectedBounds.south || randomPoint.lat > selectedBounds.north ||
        randomPoint.lng < selectedBounds.west || randomPoint.lng > selectedBounds.east) {
      debugStats.outOfBounds++;
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

    if (tooClose) {
      debugStats.tooClose++;
      continue;
    }

    // Проверяем, что точка не в запретной зоне
    let inForbiddenZone = false;
    for (const polygon of forbiddenPolygons) {
      if (pointInPolygon(randomPoint, polygon)) {
        inForbiddenZone = true;
        break;
      }
    }

    if (inForbiddenZone) {
      debugStats.inForbiddenZone++;
      continue;
    }

    // Проверяем достижимость от стартовой точки
    const pointNodeIdx = findNearestNodeIdx(randomPoint.lat, randomPoint.lng, graph.nodes);
    if (pointNodeIdx === -1) {
      debugStats.noNearestNode++;
      continue;
    }

    if (!isReachable(graph, startNodeIdx, pointNodeIdx)) {
      debugStats.notReachable++;
      addFailedAttemptMarker(randomPoint, 'Недостижимо');
      continue;
    }

    // Добавляем точку
    points.push(randomPoint);
    addPointMarker(randomPoint, points.length);
    debugStats.success++;
    
    // Обновляем статус каждые 5 точек
    if (points.length % 5 === 0) {
      statusCallback(`🎯 Сгенерировано ${points.length}/${count} точек...`);
    }
  }

  // Выводим отладочную информацию
  console.log('🔍 Отладочная информация генерации точек:');
  console.log(`   Всего попыток: ${debugStats.totalAttempts}`);
  console.log(`   Невалидные тропы: ${debugStats.invalidPath}`);
  console.log(`   Не удалось получить случайную точку: ${debugStats.noRandomPoint}`);
  console.log(`   Вне области: ${debugStats.outOfBounds}`);
  console.log(`   Слишком близко: ${debugStats.tooClose}`);
  console.log(`   В запретной зоне: ${debugStats.inForbiddenZone}`);
  console.log(`   Не найден ближайший узел: ${debugStats.noNearestNode}`);
  console.log(`   Недостижимо: ${debugStats.notReachable}`);
  console.log(`   Успешно: ${debugStats.success}`);
  console.log(`   Фильтрованных троп: ${filteredPaths.length}`);
  console.log(`   Запретных зон: ${forbiddenPolygons.length}`);
  console.log(`   Узлов в графе: ${graph.nodes.length}`);
  console.log(`   Минимальное расстояние: ${minDist}м`);

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
