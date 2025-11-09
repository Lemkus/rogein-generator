/**
 * Модуль генерации контрольных точек на тропах
 * Объединенный модуль с простой и надежной генерацией точек
 */

import { haversine, extractPolygons, pointInPolygon, getRandomPointOnLine, segmentIntersectsPolygon } from './utils.js';
import { fetchAllMapData, clearMapDataCache } from './optimizedOverpassAPI.js';
import { showClosedAreasOnMap, showWaterAreasOnMap, showBarriersOnMap, addPointMarker, addFailedAttemptMarker, clearPointMarkers, clearFailedAttemptMarkers, getStartPoint, clearGraphDebugLayers, updateStartPointPosition, pointMarkers, showGraphDebug } from './mapModule.js';
import { buildPathGraph, findNearestNodeIdx, isReachable } from './algorithms.js';
import { updateTargetPointsList } from './navigation.js';
import { setTrailGraph, getTrailGraph } from './routeSequence.js';
import { dijkstra } from './algorithms.js';

// Переменные для отмены генерации
let cancelGeneration = false;

// Кеш для запретных зон (оптимизация производительности)
let cachedForbiddenPolygons = null;
let cachedDataHash = null;

// Умный таймер для профилирования
class SmartTimer {
  constructor() {
    this.timers = new Map();
    this.loopCounters = new Map();
  }

  start(name) {
    this.timers.set(name, performance.now());
  }

  end(name, options = {}) {
    const startTime = this.timers.get(name);
    if (!startTime) return;
    
    const elapsed = performance.now() - startTime;
    this.timers.delete(name);
    
    const { isLoop = false, logEvery = 1, logThreshold = 100 } = options;
    
    if (isLoop) {
      // Для циклов - считаем количество итераций
      const count = this.loopCounters.get(name) || 0;
      this.loopCounters.set(name, count + 1);
      
      // Логируем только каждую N-ую итерацию или если время превысило порог
      if (count % logEvery === 0 || elapsed > logThreshold) {
        console.log(`⏱️ ${name}: ${elapsed.toFixed(2)}ms (итерация ${count + 1})`);
      }
    } else {
      // Для обычных операций - всегда логируем
      console.log(`⏱️ ${name}: ${elapsed.toFixed(2)}ms`);
    }
    
    return elapsed;
  }

  // Для циклических операций - логирует итог
  endLoop(name, totalIterations) {
    const startTime = this.timers.get(name);
    if (!startTime) return;
    
    const elapsed = performance.now() - startTime;
    this.timers.delete(name);
    const count = this.loopCounters.get(name) || totalIterations;
    this.loopCounters.delete(name);
    
    const avgTime = elapsed / count;
    console.log(`⏱️ ${name}: всего ${elapsed.toFixed(2)}ms за ${count} итераций (avg: ${avgTime.toFixed(2)}ms)`);
    
    return elapsed;
  }
}

const timer = new SmartTimer();

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
    case 1: // 🟢 Новичок - меньше попыток, легко разместить
      return count * 30;
    case 2: // 🟡 Любитель - стандартное количество
      return count * 40;
    case 3: // 🔴 Эксперт - максимум попыток для строгих требований
      return count * 60;
    default:
      return count * 40;
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

  timer.start('ГЕНЕРАЦИЯ ТОЧЕК (ОБЩЕЕ)');
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
    timer.start('API запрос (fetchAllMapData)');
    const bbox = `${selectedBounds.south},${selectedBounds.west},${selectedBounds.north},${selectedBounds.east}`;
    const mapData = await fetchAllMapData(bbox, statusCallback);
    timer.end('API запрос (fetchAllMapData)');
    
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

    // Создаем полигоны запретных зон ПЕРЕД построением графа (кешируем для производительности)
    statusCallback('Подготовка запретных зон...');
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
      timer.start('Создание запретных зон');
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
      
      timer.end('Создание запретных зон');
      statusCallback(`🚫 Создано запретных зон: ${forbiddenPolygons.length}`);
    }

    if (cancelGeneration) return;

    // ОДНО построение графа СРАЗУ с запретными зонами (оптимизация: убрано двойное построение)
    statusCallback('Построение графа троп с запретными зонами...');
    timer.start('Построение графа троп (оптимизированное)');
    const graph = buildPathGraph(pathsData, forbiddenPolygons, barriersData);
    timer.end('Построение графа троп (оптимизированное)');
    
    if (!graph || graph.nodes.length === 0) {
      statusCallback('❌ Не найдено подходящих троп в выбранной области!');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    // Находим ближайший узел к стартовой точке
    timer.start('Поиск ближайшего узла к старту');
    const startNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, graph.nodes);
    timer.end('Поиск ближайшего узла к старту');
    
    if (startNodeIdx === -1) {
      statusCallback('❌ Не удалось найти ближайшую тропу к стартовой точке!');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    // Сохраняем граф для оптимизации маршрута
    setTrailGraph(graph);
    
    // Генерируем точки
    statusCallback('Генерация точек...');
    timer.start('Генерация точек (общее время)');
    const points = await generatePointsOnPaths(
      pathsData, 
      selectedBounds, 
      startPoint, 
      count, 
      minDist,
      difficultyLevel, 
      forbiddenPolygons, 
      graph, 
      startNodeIdx, 
      statusCallback
    );

    if (cancelGeneration) return;

    timer.end('Генерация точек (общее время)');

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
    timer.end('ГЕНЕРАЦИЯ ТОЧЕК (ОБЩЕЕ)');
    buttonCallback(false);
    cancelCallback(false);
  }
}

// Генерация точек на тропах
async function generatePointsOnPaths(pathsData, selectedBounds, startPoint, count, minDist, difficultyLevel, forbiddenPolygons, graph, startNodeIdx, statusCallback) {
  const points = [];
  const maxAttempts = calculateMaxAttempts(count, difficultyLevel); // Используем функцию расчета
  let attempts = 0;
  
  // Адаптивное снижение minDist с учетом уровня сложности
  let currentMinDist = minDist;
  const originalMinDist = minDist;
  let reductionStep = 0;
  const maxReductions = 5; // Максимум 5 снижений
  let lastPointsCount = 0;
  let stuckCounter = 0; // Счётчик "застреваний"
  
  // Минимальный порог снижения зависит от уровня сложности
  // Гарантируем, что Эксперт всегда >= Любитель >= Новичок
  const minDistThreshold = (() => {
    const level = parseInt(difficultyLevel);
    switch (level) {
      case 1: return originalMinDist * 0.45; // Новичок: может снизиться до 45%
      case 2: return originalMinDist * 0.55; // Любитель: до 55%
      case 3: return originalMinDist * 0.65; // Эксперт: до 65% (более гибко, но всё еще строже)
      default: return originalMinDist * 0.55;
    }
  })();

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
  
  let findNearestNodeCalls = 0;
  let isReachableCalls = 0;
  let inForbiddenZoneChecks = 0;

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
        
        if (reductionStep < maxReductions && currentMinDist > minDistThreshold) {
          reductionStep++;
          
          // Адаптивное снижение с учетом уровня сложности
          const level = parseInt(difficultyLevel);
          let reductionFactor;
          
          // Прогрессивное снижение: раньше медленнее, потом быстрее
          if (level === 3) {
            reductionFactor = reductionStep <= 2 ? 0.08 : (reductionStep <= 4 ? 0.12 : 0.18); // Эксперт: -8%/-12%/-18%
          } else if (level === 2) {
            reductionFactor = reductionStep <= 2 ? 0.12 : (reductionStep <= 4 ? 0.16 : 0.22); // Любитель: -12%/-16%/-22%
          } else {
            reductionFactor = reductionStep <= 2 ? 0.16 : (reductionStep <= 4 ? 0.20 : 0.26); // Новичок: -16%/-20%/-26%
          }
          
          // Применяем снижение, но не ниже порога
          const newMinDist = originalMinDist * Math.pow(1 - reductionFactor, reductionStep);
          currentMinDist = Math.max(newMinDist, minDistThreshold);
          
          const reachedThreshold = currentMinDist === minDistThreshold ? ' [ПОРОГ]' : '';
          console.log(`⚠️ Снижение minDist (уровень ${level}, -${(reductionFactor*100).toFixed(0)}%): ${originalMinDist.toFixed(0)}м → ${currentMinDist.toFixed(0)}м (шаг ${reductionStep}/${maxReductions}, порог: ${minDistThreshold.toFixed(0)}м)${reachedThreshold}`);
          statusCallback(`⚙️ Адаптация расстояний (шаг ${reductionStep})...`);
        }
      } else {
        stuckCounter = 0; // Сбрасываем счётчик если прогресс есть
      }
      
      // АВАРИЙНЫЙ РЕЖИМ: если осталось мало попыток и не все точки размещены
      const emergencyThreshold = maxAttempts * 0.2; // 20% от общего количества попыток
      if (remainingAttempts < emergencyThreshold && remainingPoints > 0) {
        // Агрессивное снижение до порога
        if (currentMinDist > minDistThreshold) {
          // Плавное снижение в зависимости от оставшихся попыток
          const panicFactor = 1 - (remainingAttempts / emergencyThreshold);
          const emergencyMinDist = currentMinDist - (currentMinDist - minDistThreshold) * panicFactor;
          
          if (emergencyMinDist < currentMinDist) {
            currentMinDist = Math.max(emergencyMinDist, minDistThreshold);
            console.log(`🚨 АВАРИЙНЫЙ РЕЖИМ (паника: ${(panicFactor*100).toFixed(0)}%): minDist → ${currentMinDist.toFixed(0)}м (осталось ${remainingPoints} точек, ${remainingAttempts} попыток)`);
            statusCallback(`🚨 Аварийный режим (${remainingPoints} точек)...`);
          }
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
    
    inForbiddenZoneChecks++;
    
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
    timer.start('findNearestNodeIdx (в цикле)');
    const pointNodeIdx = findNearestNodeIdx(pointObj.lat, pointObj.lng, graph.nodes);
    findNearestNodeCalls++;
    if (findNearestNodeCalls % 50 === 0) {
      timer.end('findNearestNodeIdx (в цикле)', { isLoop: true, logEvery: 50 });
    }
    
    if (pointNodeIdx === -1) {
      debugStats.noNearestNode++;
      continue;
    }

    timer.start('isReachable (в цикле)');
    const isReachableResult = isReachable(graph, startNodeIdx, pointNodeIdx);
    isReachableCalls++;
    if (isReachableCalls % 50 === 0) {
      timer.end('isReachable (в цикле)', { isLoop: true, logEvery: 50 });
    }
    
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

  // Выводим итоговую статистику по времени для циклических операций
  console.log(`\n⏱️ Статистика циклических операций:`);
  console.log(`  ├─ findNearestNodeIdx вызван ${findNearestNodeCalls} раз`);
  console.log(`  ├─ isReachable вызван ${isReachableCalls} раз`);
  console.log(`  └─ Проверок запретных зон: ${inForbiddenZoneChecks}`);

  // Финальная статистика
  const reductionPercent = ((originalMinDist - currentMinDist) / originalMinDist * 100).toFixed(1);
  const successRate = (debugStats.success / count * 100).toFixed(1);
  const attemptsPerPoint = (debugStats.totalAttempts / debugStats.success).toFixed(1);
  
  console.log(`\n📊 Финальная статистика генерации:`);
  console.log(`  ├─ Успех: ${debugStats.success}/${count} точек (${successRate}%), ${attemptsPerPoint} попыток/точку`);
  console.log(`  ├─ Уровень: ${difficultyLevel} (${['🟢 Новичок', '🟡 Любитель', '🔴 Эксперт'][parseInt(difficultyLevel)-1]})`);
  console.log(`  ├─ Начальный minDist: ${originalMinDist.toFixed(0)}м`);
  console.log(`  ├─ Финальный minDist: ${currentMinDist.toFixed(0)}м (-${reductionPercent}%)`);
  console.log(`  ├─ Порог minDist: ${minDistThreshold.toFixed(0)}м (${(minDistThreshold/originalMinDist*100).toFixed(0)}%)`);
  console.log(`  ├─ Шагов адаптации: ${reductionStep}/${maxReductions}`);
  console.log(`  └─ Причины отклонения:`);
  console.log(`     ├─ Слишком близко: ${debugStats.tooClose} (${(debugStats.tooClose/debugStats.totalAttempts*100).toFixed(1)}%)`);
  console.log(`     ├─ В запретной зоне: ${debugStats.inForbiddenZone} (${(debugStats.inForbiddenZone/debugStats.totalAttempts*100).toFixed(1)}%)`);
  console.log(`     ├─ Недостижима: ${debugStats.notReachable} (${(debugStats.notReachable/debugStats.totalAttempts*100).toFixed(1)}%)`);
  console.log(`     └─ Другие: ${debugStats.invalidPath + debugStats.noRandomPoint + debugStats.outOfBounds + debugStats.outOfPolygon + debugStats.noNearestNode}`);

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

/**
 * Масштабирование точек ближе к старту по графу троп
 * @param {number} scaleFactor - Коэффициент масштабирования (0.0 - 1.0)
 * @param {Object} startPoint - Точка старта {lat, lng}
 * @returns {Promise<Array>} - Массив новых координат точек [{lat, lng}, ...]
 */
export async function scalePointsOnGraph(scaleFactor, startPoint) {
  console.log(`📏 Масштабирование точек по графу (коэффициент: ${scaleFactor.toFixed(3)})`);
  
  // Получаем граф троп
  const trailGraph = getTrailGraph();
  if (!trailGraph || !trailGraph.nodes || trailGraph.nodes.length === 0) {
    console.warn('⚠️ Граф недоступен для масштабирования');
    throw new Error('Граф троп недоступен');
  }

  // Находим стартовый узел в графе
  const startNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, trailGraph.nodes);
  if (startNodeIdx === -1) {
    console.warn('⚠️ Не найден стартовый узел в графе');
    throw new Error('Стартовый узел не найден в графе');
  }

  const newPoints = [];
  
  // Для каждой точки
  for (let i = 0; i < pointMarkers.length; i++) {
    const marker = pointMarkers[i];
    const pointCoords = marker.getLatLng();
    
    // Находим ближайший узел графа к точке
    const pointNodeIdx = findNearestNodeIdx(pointCoords.lat, pointCoords.lng, trailGraph.nodes);
    
    if (pointNodeIdx === -1) {
      // Если точка не на графе, оставляем как есть
      console.warn(`⚠️ Точка ${i + 1} не найдена на графе, оставляем как есть`);
      newPoints.push({lat: pointCoords.lat, lng: pointCoords.lng});
      continue;
    }

    // Находим путь от старта до точки по графу
    const pathResult = dijkstra(trailGraph, startNodeIdx, pointNodeIdx);
    
    if (pathResult.distance === Infinity || pathResult.path.length === 0) {
      // Если пути нет, оставляем как есть
      console.warn(`⚠️ Путь от старта до точки ${i + 1} не найден, оставляем как есть`);
      newPoints.push({lat: pointCoords.lat, lng: pointCoords.lng});
      continue;
    }

    // Вычисляем целевое расстояние
    const currentDist = pathResult.distance;
    const targetDist = currentDist * scaleFactor;

    // Если целевое расстояние больше текущего, оставляем как есть
    if (targetDist >= currentDist) {
      newPoints.push({lat: pointCoords.lat, lng: pointCoords.lng});
      continue;
    }

    // Находим узел на пути, который находится на целевом расстоянии
    let accumulatedDist = 0;
    let targetNodeIdx = startNodeIdx;
    let targetPoint = null;
    
    for (let j = 0; j < pathResult.path.length - 1; j++) {
      const currentNodeIdx = pathResult.path[j];
      const nextNodeIdx = pathResult.path[j + 1];
      
      const segmentDist = haversine(
        trailGraph.nodes[currentNodeIdx].lat,
        trailGraph.nodes[currentNodeIdx].lon,
        trailGraph.nodes[nextNodeIdx].lat,
        trailGraph.nodes[nextNodeIdx].lon
      );
      
      if (accumulatedDist + segmentDist >= targetDist) {
        // Целевое расстояние находится на этом сегменте
        // Вычисляем точку на сегменте
        const remainingDist = targetDist - accumulatedDist;
        const ratio = remainingDist / segmentDist;
        
        const targetLat = trailGraph.nodes[currentNodeIdx].lat + 
          (trailGraph.nodes[nextNodeIdx].lat - trailGraph.nodes[currentNodeIdx].lat) * ratio;
        const targetLon = trailGraph.nodes[currentNodeIdx].lon + 
          (trailGraph.nodes[nextNodeIdx].lon - trailGraph.nodes[currentNodeIdx].lon) * ratio;
        
        targetPoint = {lat: targetLat, lng: targetLon};
        break;
      }
      
      accumulatedDist += segmentDist;
      targetNodeIdx = nextNodeIdx;
    }
    
    // Если не нашли точку на сегменте, используем последний узел
    if (!targetPoint) {
      targetPoint = {
        lat: trailGraph.nodes[targetNodeIdx].lat,
        lng: trailGraph.nodes[targetNodeIdx].lon
      };
    }
    
    newPoints.push(targetPoint);
  }
  
  console.log(`✅ Масштабирование завершено: ${newPoints.length} точек`);
  return newPoints;
}
