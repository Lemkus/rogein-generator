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
    console.log('🔍 Поиск ближайшего узла к стартовой точке...');
    console.log(`   Стартовая точка: lat=${startPoint.lat}, lng=${startPoint.lng}`);
    console.log(`   Узлов в графе: ${graph.nodes.length}`);
    
    const startNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, graph.nodes);
    console.log(`   Найденный стартовый узел: ${startNodeIdx}`);
    
    if (startNodeIdx === -1) {
      console.log('❌ Не удалось найти ближайший узел к стартовой точке!');
      statusCallback('❌ Не удалось найти ближайшую тропу к стартовой точке!');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }
    
    console.log(`✅ Стартовый узел найден: ${startNodeIdx}`);
    console.log(`   Координаты стартового узла: lat=${graph.nodes[startNodeIdx].lat}, lon=${graph.nodes[startNodeIdx].lon}`);

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
    console.log(`🔍 Создано запретных зон: ${forbiddenPolygons.length}`);

    if (cancelGeneration) return;

    // Пересоздаем граф с учетом запретных зон
    statusCallback('Обновление графа с запретными зонами...');
    console.log('🔍 Пересоздание графа с запретными зонами...');
    const updatedGraph = buildPathGraph(pathsData, forbiddenPolygons, barriersData);
    
    console.log('🔍 Обновленный граф:');
    console.log(`   Узлы: ${updatedGraph ? updatedGraph.nodes.length : 0}`);
    console.log(`   Рёбра: ${updatedGraph ? updatedGraph.adj.length : 0}`);
    console.log(`   Исключённые сегменты: ${updatedGraph ? updatedGraph.excludedSegments.length : 0}`);
    
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
  console.log('🔍 Начало генерации точек на тропах...');
  console.log(`   Параметры: count=${count}, minDist=${minDist}, startNodeIdx=${startNodeIdx}`);
  
  const points = [];
  const maxAttempts = count * 10; // Максимальное количество попыток
  let attempts = 0;

  // Фильтруем тропы по выбранной области
  console.log('🔍 Фильтрация троп...');
  console.log(`   Всего троп: ${pathsData.length}`);
  
  // Проверяем структуру первых нескольких троп
  if (pathsData.length > 0) {
    console.log('🔍 Структура первой тропы:', pathsData[0]);
    console.log('🔍 Ключи первой тропы:', Object.keys(pathsData[0]));
    if (pathsData[0].geometry) {
      console.log('🔍 Ключи geometry:', Object.keys(pathsData[0].geometry));
    }
  }
  
  const filteredPaths = pathsData.filter(path => {
    // Проверяем, что geometry существует и является массивом с координатами
    return path.geometry && Array.isArray(path.geometry) && path.geometry.length > 0;
  });

  console.log(`   Фильтрованных троп: ${filteredPaths.length}`);
  
  if (filteredPaths.length === 0) {
    console.log('❌ Не найдено подходящих троп!');
    statusCallback('❌ Не найдено подходящих троп в выбранной области!');
    return points;
  }

  statusCallback(`🎯 Генерация точек на ${filteredPaths.length} тропах...`);

  // Дополнительная отладочная информация
  console.log('🔍 Дополнительная отладочная информация:');
  console.log(`   Фильтрованных троп: ${filteredPaths.length}`);
  console.log(`   Запрошено точек: ${count}`);
  console.log(`   Минимальное расстояние: ${minDist}м`);
  console.log(`   Максимальных попыток: ${maxAttempts}`);
  console.log(`   Запретных зон: ${forbiddenPolygons.length}`);
  console.log(`   Узлов в графе: ${graph.nodes.length}`);
  console.log(`   Стартовый узел: ${startNodeIdx}`);

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

  console.log('🔍 Начинаем цикл генерации точек...');
  
  while (points.length < count && attempts < maxAttempts && !cancelGeneration) {
    attempts++;
    debugStats.totalAttempts++;
    
    // Логируем каждые 50 попыток для более частого отслеживания
    if (attempts % 50 === 0) {
      console.log(`🔍 Попытка ${attempts}: точек ${points.length}/${count}`);
    }
    
    // Выбираем случайную тропу
    const randomPath = filteredPaths[Math.floor(Math.random() * filteredPaths.length)];
    const coordinates = randomPath.geometry; // geometry уже является массивом координат
    
    if (coordinates.length < 2) {
      debugStats.invalidPath++;
      if (debugStats.invalidPath <= 3) {
        console.log(`🔍 Невалидная тропа ${debugStats.invalidPath}:`, randomPath);
      }
      continue;
    }

    // Конвертируем координаты в формат, ожидаемый getRandomPointOnLine
    const linePoints = coordinates.map(coord => ({
      lat: coord[0],
      lon: coord[1]
    }));
    
    // Выбираем случайную точку на тропе
    const randomPoint = getRandomPointOnLine(linePoints);
    
    if (!randomPoint) {
      debugStats.noRandomPoint++;
      if (debugStats.noRandomPoint <= 3) {
        console.log(`🔍 Не удалось получить случайную точку ${debugStats.noRandomPoint}:`, {
          path: randomPath,
          coordinates: coordinates.slice(0, 3), // первые 3 точки для примера
          linePoints: linePoints.slice(0, 3)
        });
      }
      continue;
    }
    
    // Конвертируем результат в объект с lat/lng
    const pointObj = {
      lat: randomPoint[0],
      lng: randomPoint[1]
    };

    // Проверяем, что точка в выбранной области
    if (pointObj.lat < selectedBounds.south || pointObj.lat > selectedBounds.north ||
        pointObj.lng < selectedBounds.west || pointObj.lng > selectedBounds.east) {
      debugStats.outOfBounds++;
      continue;
    }

    // Проверяем минимальное расстояние от других точек
    let tooClose = false;
    for (const existingPoint of points) {
      const distance = haversine(pointObj.lat, pointObj.lng, existingPoint.lat, existingPoint.lng);
      if (distance < minDist) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) {
      debugStats.tooClose++;
      if (debugStats.tooClose <= 3) {
        console.log(`🔍 Слишком близко ${debugStats.tooClose}:`, {
          point: pointObj,
          minDist: minDist,
          existingPoints: points.length
        });
      }
      continue;
    }

    // Проверяем, что точка не в запретной зоне
    let inForbiddenZone = false;
    for (const polygon of forbiddenPolygons) {
      if (pointInPolygon(pointObj, polygon)) {
        inForbiddenZone = true;
        break;
      }
    }

    if (inForbiddenZone) {
      debugStats.inForbiddenZone++;
      continue;
    }

    // Проверяем достижимость от стартовой точки
    const pointNodeIdx = findNearestNodeIdx(pointObj.lat, pointObj.lng, graph.nodes);
    if (pointNodeIdx === -1) {
      debugStats.noNearestNode++;
      if (debugStats.noNearestNode <= 3) {
        console.log(`🔍 Не найден ближайший узел ${debugStats.noNearestNode}:`, {
          point: pointObj,
          startNodeIdx: startNodeIdx
        });
      }
      continue;
    }

    const isReachableResult = isReachable(graph, startNodeIdx, pointNodeIdx);
    if (!isReachableResult) {
      debugStats.notReachable++;
      if (debugStats.notReachable <= 5) {
        console.log(`🔍 Недостижимо ${debugStats.notReachable}:`, {
          point: pointObj,
          pointNodeIdx: pointNodeIdx,
          startNodeIdx: startNodeIdx,
          graphNodes: graph.nodes.length,
          graphAdj: graph.adj.length
        });
      }
      addFailedAttemptMarker(pointObj, 'Недостижимо');
      continue;
    }

    // Добавляем точку
    points.push(pointObj);
    addPointMarker(pointObj, points.length);
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
