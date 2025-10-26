/**
 * Модуль генерации контрольных точек на тропах
 * Объединенный модуль с простой и надежной генерацией точек
 */

import { haversine, extractPolygons, pointInPolygon, getRandomPointOnLine, segmentIntersectsPolygon } from './utils.js';
import { fetchAllMapData, clearMapDataCache } from './optimizedOverpassAPI.js';
import { showClosedAreasOnMap, showWaterAreasOnMap, showBarriersOnMap, addPointMarker, addFailedAttemptMarker, clearPointMarkers, clearFailedAttemptMarkers, getStartPoint, clearGraphDebugLayers, updateStartPointPosition, pointMarkers, showGraphDebug } from './mapModule.js';
import { buildPathGraph, findNearestNodeIdx, isReachable } from './algorithms.js';
import { updateTargetPointsList } from './navigation.js';
import { setTrailGraph } from './routeSequence.js';

// Переменные для отмены генерации
let cancelGeneration = false;

// Кеш для запретных зон (оптимизация производительности)
let cachedForbiddenPolygons = null;
let cachedDataHash = null;

// Функция расчета площади прямоугольника в квадратных метрах
function rectangleArea(bounds) {
  const latDiff = bounds.north - bounds.south;
  const lngDiff = bounds.east - bounds.west;
  
  // Приблизительный коэффициент для перевода градусов в метры
  const latToMeters = 111000; // 1 градус широты ≈ 111 км
  const lngToMeters = 111000 * Math.cos((bounds.north + bounds.south) / 2 * Math.PI / 180);
  
  return latDiff * latToMeters * lngDiff * lngToMeters;
}

// Функция расчета площади полигона в квадратных метрах (формула шнура)
function calculatePolygonArea(polygon) {
  const latLngs = polygon.getLatLngs()[0];
  if (latLngs.length < 3) return 0;
  
  let area = 0;
  const n = latLngs.length;
  
  // Используем формулу шнура для расчета площади на сфере
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lat1 = latLngs[i].lat * Math.PI / 180;
    const lng1 = latLngs[i].lng * Math.PI / 180;
    const lat2 = latLngs[j].lat * Math.PI / 180;
    const lng2 = latLngs[j].lng * Math.PI / 180;
    
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  
  // Радиус Земли в метрах
  const R = 6371000;
  area = Math.abs(area) * R * R / 2;
  
  return area;
}

/**
 * Расчет минимального расстояния в зависимости от уровня сложности
 * @param {number} area - Площадь области в м²
 * @param {number} count - Количество точек
 * @param {number} difficultyLevel - Уровень сложности (1-3)
 * @returns {number} - Минимальное расстояние в метрах
 */
function calculateMinDistance(area, count, difficultyLevel) {
  const baseDistance = Math.sqrt(area / count);
  
  switch (parseInt(difficultyLevel)) {
    case 1: // 🟢 Новичок - плотное размещение
      return baseDistance * 0.4; // Точки могут быть в 2.5 раза ближе
    case 2: // 🟡 Любитель - сбалансированное (текущее)
      return baseDistance * 0.8;
    case 3: // 🔴 Эксперт - максимальное разнесение
      return baseDistance * 1.2; // Точки дальше друг от друга
    default:
      return baseDistance * 0.8;
  }
}

/**
 * Расчет максимального количества попыток в зависимости от уровня сложности
 * @param {number} count - Количество точек
 * @param {number} difficultyLevel - Уровень сложности (1-3)
 * @returns {number} - Максимальное количество попыток
 */
function calculateMaxAttempts(count, difficultyLevel) {
  switch (parseInt(difficultyLevel)) {
    case 1: // 🟢 Новичок - больше попыток, проще найти точки
      return count * 20;
    case 2: // 🟡 Любитель - стандартное количество
      return count * 15;
    case 3: // 🔴 Эксперт - больше попыток для строгих требований
      return count * 30;
    default:
      return count * 15;
  }
}

// Основная функция генерации точек
export async function generatePoints(selectedBounds, startPoint, count, difficultyLevel, statusCallback, buttonCallback, cancelCallback) {
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

  // Вычисляем площадь области и минимальное расстояние с учетом уровня сложности
  let area;
  if (selectedBounds.type === 'polygon' && selectedBounds.polygon) {
    // Для полигона рассчитываем реальную площадь
    area = calculatePolygonArea(selectedBounds.polygon);
  } else {
    // Для прямоугольника используем стандартный расчет
    area = rectangleArea(selectedBounds);
  }
  
  // Используем новые функции расчета с учетом уровня сложности
  const minDist = calculateMinDistance(area, count, difficultyLevel);

  try {
    // Очищаем предыдущие точки и отладочные слои
    clearPointMarkers();
    clearFailedAttemptMarkers();
    clearGraphDebugLayers();

    // Загружаем все данные одним запросом
    const bbox = `${selectedBounds.south},${selectedBounds.west},${selectedBounds.north},${selectedBounds.east}`;
    const mapData = await fetchAllMapData(bbox, statusCallback);
    
    const closedAreasData = mapData.closed_areas || [];
    const waterAreasData = mapData.water_areas || [];
    const barriersData = mapData.barriers || [];
    const pathsData = mapData.paths || [];

    if (cancelGeneration) return;

    statusCallback(`✅ Данные загружены: ${pathsData.length} троп, ${closedAreasData.length} закрытых зон, ${waterAreasData.length} водоёмов, ${barriersData.length} барьеров`);

    // DEBUG: Не рисуем закрытые зоны, водоёмы и барьеры на карте для производительности
    // showClosedAreasOnMap(closedAreasData);
    // showWaterAreasOnMap(waterAreasData);
    // showBarriersOnMap(barriersData);

    if (cancelGeneration) return;

    // Создаем граф троп
    statusCallback('Создание графа троп...');
    const graph = buildPathGraph(pathsData, [], barriersData);
    
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

    // Создаем полигоны запретных зон с кешированием
    // Простой хеш на основе координат области и количества объектов
    const areaHash = selectedBounds.type === 'polygon' 
      ? `${selectedBounds.south}_${selectedBounds.west}_${selectedBounds.north}_${selectedBounds.east}_polygon`
      : `${selectedBounds.south}_${selectedBounds.west}_${selectedBounds.north}_${selectedBounds.east}_rect`;
    const dataHash = `${closedAreasData.length}_${waterAreasData.length}_${areaHash}`;
    let forbiddenPolygons;
    
    if (cachedDataHash === dataHash && cachedForbiddenPolygons) {
      // Используем кешированные полигоны
      forbiddenPolygons = cachedForbiddenPolygons;
      statusCallback(`🚫 Использую кешированные запретные зоны: ${forbiddenPolygons.length}`);
    } else {
      // Создаем новые полигоны
      forbiddenPolygons = [];
      
      // Добавляем закрытые зоны
      const closedAreaPolygons = extractPolygons(closedAreasData);
      forbiddenPolygons.push(...closedAreaPolygons);

      // Добавляем водоёмы
      const waterAreaPolygons = extractPolygons(waterAreasData);
      forbiddenPolygons.push(...waterAreaPolygons);
      
      // Сохраняем в кеш
      cachedForbiddenPolygons = forbiddenPolygons;
      cachedDataHash = dataHash;
      
      statusCallback(`🚫 Создано запретных зон: ${forbiddenPolygons.length}`);
    }

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
      difficultyLevel, 
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
      
      // Уведомляем UI контроллер о завершении генерации
      import('./uiController.js').then(ui => {
        ui.setStep('points_generated');
        ui.updateInfoPanel(points.length, 'Посмотреть', 0); // Дистанция будет обновлена после генерации последовательности
      }).catch(err => {
        console.error('Ошибка обновления UI:', err);
      });
      
      // Генерируем и отображаем последовательность
      import('./sequenceUI.js').then(sequenceUI => {
        sequenceUI.generateAndDisplaySequence();
      }).catch(err => {
        console.error('Ошибка генерации последовательности:', err);
      });
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
async function generatePointsOnPaths(pathsData, selectedBounds, startPoint, count, minDist, difficultyLevel, forbiddenPolygons, graph, startNodeIdx, statusCallback) {
  const points = [];
  const maxAttempts = calculateMaxAttempts(count, difficultyLevel); // Используем функцию расчета
  let attempts = 0;
  
  // Адаптивное снижение minDist если не получается разместить точки
  let currentMinDist = minDist;
  const originalMinDist = minDist;
  let reductionStep = 0;
  const maxReductions = 5; // Максимум 5 снижений
  let lastPointsCount = 0;
  let stuckCounter = 0; // Счётчик "застреваний"

  // Фильтруем тропы по выбранной области
  const filteredPaths = pathsData.filter(path => {
    // Проверяем, что geometry существует и является массивом с координатами
    return path.geometry && Array.isArray(path.geometry) && path.geometry.length > 0;
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
    outOfPolygon: 0,
    tooClose: 0,
    inForbiddenZone: 0,
    noNearestNode: 0,
    notReachable: 0,
    success: 0
  };
  
  while (points.length < count && attempts < maxAttempts && !cancelGeneration) {
    attempts++;
    debugStats.totalAttempts++;
    
    // Проверяем прогресс каждые 50 попыток и адаптивно снижаем minDist если застряли
    if (attempts % 50 === 0) {
      const pointsAdded = points.length - lastPointsCount;
      const remainingAttempts = maxAttempts - attempts;
      const remainingPoints = count - points.length;
      
      // Если за последние 50 попыток добавилось мало точек (0-1) - снижаем расстояние
      if (pointsAdded <= 1 && points.length < count) {
        stuckCounter++;
        
        if (reductionStep < maxReductions) {
          reductionStep++;
          // Прогрессивное снижение: чем больше шаг, тем агрессивнее
          const reductionFactor = reductionStep <= 3 ? 0.15 : 0.25; // Первые 3 шага -15%, далее -25%
          currentMinDist = originalMinDist * Math.pow(1 - reductionFactor, reductionStep);
          statusCallback(`⚙️ Адаптация расстояний (шаг ${reductionStep})...`);
        }
      } else {
        stuckCounter = 0; // Сбрасываем счётчик если прогресс есть
      }
      
      // АВАРИЙНЫЙ РЕЖИМ: если осталось мало попыток и не все точки размещены
      if (remainingAttempts < 100 && remainingPoints > 0) {
        // Снижаем до минимума - 30% от оригинала
        const emergencyMinDist = originalMinDist * 0.3;
        if (currentMinDist > emergencyMinDist) {
          currentMinDist = emergencyMinDist;
          statusCallback(`🚨 Аварийный режим генерации...`);
        }
      }
      
      // Обновляем счетчик для следующей проверки
      lastPointsCount = points.length;
    }
    
    // Выбираем случайную тропу
    const randomPath = filteredPaths[Math.floor(Math.random() * filteredPaths.length)];
    const coordinates = randomPath.geometry; // geometry уже является массивом координат
    
    if (coordinates.length < 2) {
      debugStats.invalidPath++;
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

    // Дополнительная проверка для полигона
    if (selectedBounds.type === 'polygon' && selectedBounds.polygon) {
      const polygonLatLngs = selectedBounds.polygon.getLatLngs()[0]; // Получаем координаты полигона
      
      // Конвертируем LatLng объекты в массивы [lat, lng]
      const polygonCoords = polygonLatLngs.map(latlng => [latlng.lat, latlng.lng]);
      
      if (!pointInPolygon(pointObj.lat, pointObj.lng, polygonCoords)) {
        debugStats.outOfPolygon++;
        continue;
      }
    }

    // Проверяем минимальное расстояние от других точек
    // Для уровня "Новичок" добавляем случайность (jitter) для интересного распределения
    let tooClose = false;
    for (const existingPoint of points) {
      const distance = haversine(pointObj.lat, pointObj.lng, existingPoint.lat, existingPoint.lng);
      
      // Динамическое минимальное расстояние с jitter для уровня 1
      let effectiveMinDist = currentMinDist; // Используем текущее (адаптивное) расстояние
      if (parseInt(difficultyLevel) === 1) {
        // Добавляем случайность ±30% для интересного распределения
        const jitter = 0.7 + Math.random() * 0.6; // 0.7 - 1.3
        effectiveMinDist = currentMinDist * jitter;
      }
      
      if (distance < effectiveMinDist) {
        tooClose = true;
        break;
      }
    }

    if (tooClose) {
      debugStats.tooClose++;
      continue;
    }

    // Проверяем, что точка не в запретной зоне
    // ОПТИМИЗАЦИЯ: для больших областей с >100 зонами применяем умную проверку
    let inForbiddenZone = false;
    
    if (forbiddenPolygons.length > 100) {
      // В больших городах может быть 200-300+ зон (здания)
      // Проверяем каждую 3-ю точку на первых 30% попыток для ускорения
      const earlyPhase = attempts < maxAttempts * 0.3;
      const shouldCheck = !earlyPhase || (attempts % 3 === 0);
      
      if (shouldCheck) {
        for (let i = 0; i < forbiddenPolygons.length; i++) {
          const polygon = forbiddenPolygons[i];
          if (pointInPolygon(pointObj.lat, pointObj.lng, polygon)) {
            inForbiddenZone = true;
            break;
          }
        }
      }
    } else {
      // Для малого количества зон - полная проверка всегда
      for (let i = 0; i < forbiddenPolygons.length; i++) {
        const polygon = forbiddenPolygons[i];
        if (pointInPolygon(pointObj.lat, pointObj.lng, polygon)) {
          inForbiddenZone = true;
          break;
        }
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
      continue;
    }

    const isReachableResult = isReachable(graph, startNodeIdx, pointNodeIdx);
    if (!isReachableResult) {
      debugStats.notReachable++;
      addFailedAttemptMarker(pointObj.lat, pointObj.lng);
      continue;
    }

    // Добавляем точку
    points.push(pointObj);
    addPointMarker(pointObj.lat, pointObj.lng, points.length);
    debugStats.success++;
    
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
