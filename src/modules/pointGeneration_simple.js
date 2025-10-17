/**
 * Модуль генерации контрольных точек на тропах - УПРОЩЕННАЯ ВЕРСИЯ
 * Простая и надежная генерация точек без сложных алгоритмов
 */

import { haversine, rectangleArea, extractPolygons, pointInPolygon, getRandomPointOnLine, segmentIntersectsPolygon } from './utils.js';
import { fetchAllMapData, clearMapDataCache } from './optimizedOverpassAPI.js';
import { showClosedAreasOnMap, showWaterAreasOnMap, showBarriersOnMap, addPointMarker, addFailedAttemptMarker, clearPointMarkers, clearFailedAttemptMarkers, getStartPoint, clearGraphDebugLayers, updateStartPointPosition } from './mapModule.js';
import { buildPathGraph, findNearestNodeIdx, isReachable } from './algorithms.js';
import { updateTargetPointsList } from './navigation.js';
import { setTrailGraph } from './routeSequence.js';

// Переменные для отмены генерации
let cancelGeneration = false;

// Основная функция генерации точек - ПРОСТАЯ ВЕРСИЯ
export async function generatePointsSimple(selectedBounds, startPoint, count, statusCallback, buttonCallback, cancelCallback) {
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

  const sw = selectedBounds.getSouthWest();
  const ne = selectedBounds.getNorthEast();

  // ГИБКИЙ расчет начального расстояния - стремимся к максимуму, но готовы к компромиссам
  const area = rectangleArea(selectedBounds); // в м^2
  
  // Начинаем с оптимистичного расчета (90% площади для максимального распределения)
  const optimisticAreaPerPoint = (area * 0.9) / count;
  const optimisticMinDist = 2 * Math.sqrt(optimisticAreaPerPoint / Math.PI);
  
  // Консервативный расчет (60% площади - учитываем много препятствий)
  const conservativeAreaPerPoint = (area * 0.6) / count;
  const conservativeMinDist = 2 * Math.sqrt(conservativeAreaPerPoint / Math.PI);
  
  // Начальное расстояние: между оптимистичным и консервативным, но не менее 50м
  const initialMinDist = Math.max((optimisticMinDist + conservativeMinDist) / 2, 50);
  
  // Минимальное расстояние, ниже которого не опускаемся (гарантия качества)
  const absoluteMinDist = Math.max(conservativeMinDist * 0.7, 40);
  
  const adaptiveMinDist = Math.min(initialMinDist, 400); // Максимум 400м для разумности
  
  console.log(`📏 Гибкий расчет расстояний:`);
  console.log(`   Площадь области: ${(area / 1000000).toFixed(2)} км²`);
  console.log(`   Оптимистичное расстояние: ${optimisticMinDist.toFixed(1)}м`);
  console.log(`   Консервативное расстояние: ${conservativeMinDist.toFixed(1)}м`);
  console.log(`   Начальное расстояние: ${adaptiveMinDist.toFixed(1)}м`);
  console.log(`   Абсолютный минимум: ${absoluteMinDist.toFixed(1)}м`);

  statusCallback(`🎯 Начальное расстояние: ${adaptiveMinDist.toFixed(0)}м (будет адаптироваться для размещения всех ${count} точек)`);

  try {
    // Проверяем что область выбрана
    if (!selectedBounds || !selectedBounds.south || !selectedBounds.west || !selectedBounds.north || !selectedBounds.east) {
      throw new Error('Сначала выберите область на карте, нарисовав прямоугольник');
    }
    
    // Загружаем все данные одним запросом
    const bbox = `${selectedBounds.south},${selectedBounds.west},${selectedBounds.north},${selectedBounds.east}`;
    console.log(`🎯 Выбранная область: ${bbox}`);
    const mapData = await fetchAllMapData(bbox, statusCallback);
    
    const closedAreasData = mapData.closed_areas || [];
    const waterAreasData = mapData.water_areas || [];
    const barriersData = mapData.barriers || [];
    const pathsData = mapData.paths || [];

    if (cancelGeneration) {
      statusCallback('Отменено пользователем.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    // Отображаем на карте
    showClosedAreasOnMap(closedAreasData);
    showWaterAreasOnMap(waterAreasData);
    showBarriersOnMap(barriersData);

    statusCallback('Построение графа троп...');
    clearGraphDebugLayers();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Получаем все запрещённые полигоны
    const allForbiddenAreas = [...closedAreasData, ...waterAreasData];
    const forbiddenPolygons = extractPolygons(allForbiddenAreas);
    console.log(`Найдено ${forbiddenPolygons.length} запрещённых полигонов`);

    // Строим граф троп
    console.log(`Строим граф из ${pathsData.length} путей...`);
    const graphResult = buildPathGraph(pathsData, forbiddenPolygons, barriersData);
    const graph = { nodes: graphResult.nodes, adj: graphResult.adj };
    console.log(`Граф построен: ${graph.nodes.length} узлов`);
    
    if (graph.nodes.length === 0) {
      statusCallback('❌ Не удалось построить граф троп. Проверьте данные.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }
    
    // Сохраняем граф для использования в построении последовательности
    setTrailGraph(graph);

    // Проверяем связность с начальной точкой
    const startNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, graph.nodes);
    
    if (startNodeIdx === -1) {
      statusCallback('Не найдены тропы рядом с точкой старта! Переместите точку старта ближе к тропам.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    const nearestNode = graph.nodes[startNodeIdx];
    const distanceToNearestPath = haversine(startPoint.lat, startPoint.lng, nearestNode.lat, nearestNode.lon);
    
    if (distanceToNearestPath > 50) {
      statusCallback(`⚠️ Точка старта далеко от троп (${distanceToNearestPath.toFixed(0)}м). Подводим к ближайшей тропе...`);
      updateStartPointPosition(nearestNode.lat, nearestNode.lon);
      startPoint.lat = nearestNode.lat;
      startPoint.lng = nearestNode.lon;
      statusCallback(`✅ Точка старта перемещена к ближайшей тропе`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      statusCallback(`✅ Точка старта рядом с тропой (${distanceToNearestPath.toFixed(0)}м)`);
    }

    statusCallback(`Генерация ${count} точек простым алгоритмом...`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Очищаем старые маркеры
    clearPointMarkers();
    clearFailedAttemptMarkers();
    
    // Генерация точек с равномерным распределением
    const generatedPoints = [];
    let attempts = 0;
    const maxAttempts = count * 1000; // Увеличиваем количество попыток
    let currentMinDist = adaptiveMinDist;
    const minFloor = absoluteMinDist; // Используем рассчитанный абсолютный минимум

    console.log(`Начинаем генерацию ${count} точек с равномерным распределением`);
    
    // Статистика отклонений
    let rejectedByGraph = 0;
    let rejectedByDirectPath = 0;

    // Создаем виртуальную сетку для равномерного распределения
    const gridSize = Math.max(3, Math.ceil(Math.sqrt(count))); // Минимум 3x3, обычно sqrt(count)
    const cellWidth = (ne.lng - sw.lng) / gridSize;
    const cellHeight = (ne.lat - sw.lat) / gridSize;
    
    console.log(`Создана виртуальная сетка ${gridSize}x${gridSize} для равномерного распределения`);

    // Предварительно собираем точки по ячейкам сетки
    const cellPoints = new Map();
    
    // Распределяем все точки троп по ячейкам
    pathsData.forEach(path => {
      if (!path.geometry || !Array.isArray(path.geometry)) return;
      
      // Берем каждую 5-ю точку для оптимизации
      for (let i = 0; i < path.geometry.length; i += 5) {
        const coord = path.geometry[i];
        let lat, lon;
        
        if (Array.isArray(coord) && coord.length >= 2) {
          [lat, lon] = coord;
        } else if (coord && typeof coord === 'object') {
          lat = coord.lat;
          lon = coord.lon;
        } else {
          continue;
        }
        
        if (typeof lat !== 'number' || typeof lon !== 'number' || 
            lat < sw.lat || lat > ne.lat || lon < sw.lng || lon > ne.lng) continue;
        
        // Определяем ячейку
        const cellX = Math.min(Math.floor((lon - sw.lng) / cellWidth), gridSize - 1);
        const cellY = Math.min(Math.floor((lat - sw.lat) / cellHeight), gridSize - 1);
        const cellIndex = cellY * gridSize + cellX;
        
        if (!cellPoints.has(cellIndex)) {
          cellPoints.set(cellIndex, []);
        }
        cellPoints.get(cellIndex).push([lat, lon]);
      }
    });

    console.log(`Распределено точки по ${cellPoints.size} ячейкам из ${gridSize * gridSize} возможных`);

    // Отслеживаем использование ячеек для равномерности
    const cellUsage = new Map();
    cellPoints.forEach((points, cellIndex) => {
      cellUsage.set(cellIndex, 0);
    });

    // УЛУЧШЕННАЯ генерация точек с принудительным равномерным распределением
    const targetPointsPerCell = Math.ceil(count / cellPoints.size); // Целевое количество точек на ячейку
    console.log(`Цель: максимум ${targetPointsPerCell} точек на ячейку для равномерности`);
    
    while (generatedPoints.length < count && attempts < maxAttempts) {
      if (cancelGeneration) {
        statusCallback('Отменено пользователем.');
        buttonCallback(false);
        cancelCallback(false);
        return;
      }

      attempts++;

      // УМНОЕ адаптивное снижение расстояния в зависимости от прогресса
      const progress = generatedPoints.length / count;
      const attemptProgress = attempts / maxAttempts;
      
      // Снижаем расстояние если:
      // 1. Много попыток без результата
      // 2. Мало точек размещено относительно целевого количества
      let shouldReduce = false;
      let reductionFactor = 1.0;
      
      if (attempts > 0 && attempts % 100 === 0) {
        if (progress < 0.3 && attemptProgress > 0.2) {
          // Если размещено меньше 30% точек, а попыток уже больше 20%
          shouldReduce = true;
          reductionFactor = 0.9; // Снижаем на 10%
        } else if (progress < 0.6 && attemptProgress > 0.4) {
          // Если размещено меньше 60% точек, а попыток уже больше 40%
          shouldReduce = true;
          reductionFactor = 0.93; // Снижаем на 7%
        } else if (progress < 0.8 && attemptProgress > 0.6) {
          // Если размещено меньше 80% точек, а попыток уже больше 60%
          shouldReduce = true;
          reductionFactor = 0.95; // Снижаем на 5%
        } else if (progress < 1.0 && attemptProgress > 0.8) {
          // В конце - более агрессивное снижение
          shouldReduce = true;
          reductionFactor = 0.85; // Снижаем на 15%
        }
      }
      
      if (shouldReduce) {
        const oldDist = currentMinDist;
        currentMinDist = Math.max(minFloor, currentMinDist * reductionFactor);
        console.log(`⚙️ АДАПТИВНОЕ снижение дистанции: ${oldDist.toFixed(1)}м → ${currentMinDist.toFixed(1)}м`);
        console.log(`   Прогресс: ${(progress * 100).toFixed(1)}% точек, ${(attemptProgress * 100).toFixed(1)}% попыток`);
        
        // Обновляем статус для пользователя
        statusCallback(`⚙️ Адаптация: снижаем расстояние до ${currentMinDist.toFixed(0)}м для размещения всех точек (${generatedPoints.length}/${count})`);
      }

      // Получаем ячейки, отсортированные по использованию (приоритет неиспользованным)
      const availableCells = Array.from(cellUsage.entries())
        .filter(([cellIndex, usage]) => cellPoints.has(cellIndex) && cellPoints.get(cellIndex).length > 0)
        .sort((a, b) => a[1] - b[1]); // Сортируем по возрастанию использования

      if (availableCells.length === 0) {
        console.log('Нет доступных ячеек с точками');
        break;
      }

      // СТРОГИЙ выбор ячейки: сначала полностью заполняем неиспользованные ячейки
      const minUsage = availableCells[0][1];
      const leastUsedCells = availableCells.filter(([cellIndex, usage]) => usage === minUsage);
      
      // Если есть совсем неиспользованные ячейки, выбираем только из них
      let selectedCell;
      if (minUsage === 0) {
        selectedCell = leastUsedCells[Math.floor(Math.random() * leastUsedCells.length)];
      } else if (minUsage < targetPointsPerCell) {
        // Если все ячейки использованы, но не достигли цели, выбираем из недозаполненных
        selectedCell = leastUsedCells[Math.floor(Math.random() * leastUsedCells.length)];
      } else {
        // Все ячейки заполнены до цели, выбираем наименее используемую
        selectedCell = availableCells[0];
      }
      
      const cellIndex = selectedCell[0];

      // Получаем точки из выбранной ячейки
      const cellPointsList = cellPoints.get(cellIndex);
      if (!cellPointsList || cellPointsList.length === 0) {
        continue;
      }

      // Выбираем случайную точку из ячейки
      const randomPointIndex = Math.floor(Math.random() * cellPointsList.length);
      const [lat, lon] = cellPointsList[randomPointIndex];

      // Проверяем запрещенные зоны
      let inForbiddenArea = false;
      for (const poly of forbiddenPolygons) {
        if (pointInPolygon(lat, lon, poly)) {
          inForbiddenArea = true;
          break;
        }
      }
      if (inForbiddenArea) {
        // Удаляем неподходящую точку из ячейки
        cellPointsList.splice(randomPointIndex, 1);
        addFailedAttemptMarker(lat, lon);
        continue;
      }

      // ОЧЕНЬ СТРОГАЯ проверка минимального расстояния
      let tooClose = false;
      let minDistanceFound = Infinity;
      let closestPointIndex = -1;
      
      // Проверяем расстояние до всех существующих точек
      for (let i = 0; i < generatedPoints.length; i++) {
        const existingPoint = generatedPoints[i];
        const distance = haversine(lat, lon, existingPoint[0], existingPoint[1]);
        if (distance < minDistanceFound) {
          minDistanceFound = distance;
          closestPointIndex = i + 1; // +1 для номера точки (начиная с 1)
        }
        if (distance < currentMinDist) {
          tooClose = true;
          break;
        }
      }
      
      // Проверяем расстояние до точки старта
      const distanceToStart = haversine(lat, lon, startPoint.lat, startPoint.lng);
      if (distanceToStart < minDistanceFound) {
        minDistanceFound = distanceToStart;
        closestPointIndex = 0; // 0 для точки старта
      }
      if (distanceToStart < currentMinDist) {
        tooClose = true;
      }
      
      if (tooClose) {
        // Более агрессивное удаление точек для лучшего распределения
        if (attempts > 50 && minDistanceFound < currentMinDist * 0.7) {
          cellPointsList.splice(randomPointIndex, 1);
        }
        
        addFailedAttemptMarker(lat, lon);
        continue;
      }
      
      // Дополнительная проверка: если точка в той же ячейке, что и уже размещенная
      const currentCellX = cellIndex % gridSize;
      const currentCellY = Math.floor(cellIndex / gridSize);
      
      for (let i = 0; i < generatedPoints.length; i++) {
        const existingPoint = generatedPoints[i];
        const existingCellX = Math.floor((existingPoint[1] - sw.lng) / cellWidth);
        const existingCellY = Math.floor((existingPoint[0] - sw.lat) / cellHeight);
        
        // Если точки в соседних ячейках, применяем более строгое расстояние
        const cellDistance = Math.max(Math.abs(currentCellX - existingCellX), Math.abs(currentCellY - existingCellY));
        if (cellDistance <= 1) { // Та же или соседняя ячейка
          const distance = haversine(lat, lon, existingPoint[0], existingPoint[1]);
          const strictMinDist = currentMinDist * 1.2; // На 20% больше для соседних ячеек
          
          if (distance < strictMinDist) {
            console.log(`❌ Точка слишком близко к точке ${i + 1} в соседней ячейке: ${distance.toFixed(1)}м < ${strictMinDist.toFixed(1)}м`);
            addFailedAttemptMarker(lat, lon);
            tooClose = true;
            break;
          }
        }
      }
      
      if (tooClose) {
        continue;
      }

      // АДАПТИВНАЯ проверка достижимости (становится менее строгой быстрее)
      const progressRatio = generatedPoints.length / count;
      const attemptsRatio = attempts / maxAttempts;
      const shouldSkipStrictChecks = (progressRatio < 0.5 && attemptsRatio > 0.3) || attemptsRatio > 0.6;
      
      if (!shouldSkipStrictChecks) {
        // 1. Проверяем достижимость по графу троп
        const pointNodeIdx = findNearestNodeIdx(lat, lon, graph.nodes);
        if (pointNodeIdx === -1 || !isReachable(graph, startNodeIdx, pointNodeIdx)) {
          rejectedByGraph++;
          cellPointsList.splice(randomPointIndex, 1);
          addFailedAttemptMarker(lat, lon);
          continue;
        }
        
        // 2. ПРОСТАЯ проверка: отклоняем только точки, которые находятся ВНУТРИ запрещенных зон
        // (не проверяем пересечение пути - доверяем графу троп)
        let pointInForbiddenZone = false;
        
        for (const poly of forbiddenPolygons) {
          if (pointInPolygon(lat, lon, poly)) {
            pointInForbiddenZone = true;
            if (generatedPoints.length < 3) { // Показываем для первых 3 точек
              console.log(`🚫 Точка ${generatedPoints.length + 1} отклонена: находится внутри запрещенной зоны`);
            }
            break;
          }
        }
        
        if (pointInForbiddenZone) {
          rejectedByDirectPath++;
          cellPointsList.splice(randomPointIndex, 1);
          addFailedAttemptMarker(lat, lon);
          continue;
        }
      } else {
        // В режиме пониженной строгости проверяем только базовую достижимость и что точка не в запрещенной зоне
        const pointNodeIdx = findNearestNodeIdx(lat, lon, graph.nodes);
        if (pointNodeIdx === -1 || !isReachable(graph, startNodeIdx, pointNodeIdx)) {
          rejectedByGraph++;
          cellPointsList.splice(randomPointIndex, 1);
          addFailedAttemptMarker(lat, lon);
          continue;
        }
        
        // Проверяем что точка не внутри запрещенной зоны (но не проверяем путь)
        let pointInForbiddenZone = false;
        for (const poly of forbiddenPolygons) {
          if (pointInPolygon(lat, lon, poly)) {
            pointInForbiddenZone = true;
            break;
          }
        }
        
        if (pointInForbiddenZone) {
          rejectedByDirectPath++;
          cellPointsList.splice(randomPointIndex, 1);
          addFailedAttemptMarker(lat, lon);
          continue;
        }
        
        if (generatedPoints.length < 2) {
          console.log(`⚡ Режим пониженной строгости: разрешаем точки с обходными путями`);
        }
      }

      // Точка подходит!
      generatedPoints.push([lat, lon]);
      addPointMarker(lat, lon, generatedPoints.length);

      // Увеличиваем счетчик использования ячейки
      cellUsage.set(cellIndex, cellUsage.get(cellIndex) + 1);
      
      // Удаляем использованную точку из ячейки
      cellPointsList.splice(randomPointIndex, 1);

      console.log(`✅ Размещена точка ${generatedPoints.length}: (${lat.toFixed(6)}, ${lon.toFixed(6)}) в ячейке ${cellIndex}`);
      statusCallback(`✅ Сгенерировано ${generatedPoints.length}/${count} точек (попыток: ${attempts}/${maxAttempts})`);
      
      if (generatedPoints.length % 3 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Финальный статус с анализом результата
    if (generatedPoints.length === count) {
      statusCallback(`🎯 Успешно сгенерировано ${count} точек за ${attempts} попыток!`);
      console.log(`✅ УСПЕХ: Все ${count} точек размещены успешно`);
    } else {
      const successRate = (generatedPoints.length / count * 100).toFixed(1);
      statusCallback(`⚠️ Размещено ${generatedPoints.length} из ${count} точек (${successRate}%) за ${attempts} попыток. Попробуйте уменьшить количество точек или увеличить область.`);
      console.log(`⚠️ ЧАСТИЧНЫЙ УСПЕХ: ${generatedPoints.length}/${count} точек (${successRate}%)`);
      console.log(`   Возможные причины:`);
      console.log(`   - Слишком много точек для данной области`);
      console.log(`   - Много препятствий (водоемы, закрытые зоны)`);
      console.log(`   - Недостаточно троп в области`);
      console.log(`   Рекомендации:`);
      console.log(`   - Уменьшите количество точек до ${Math.floor(generatedPoints.length * 1.2)}-${Math.floor(generatedPoints.length * 1.5)}`);
      console.log(`   - Увеличьте выделенную область`);
      console.log(`   - Выберите область с большим количеством троп`);
    }

    // Детальная статистика распределения по ячейкам
    console.log(`📊 Статистика распределения по ячейкам:`);
    console.log(`🎯 Цель: максимум ${targetPointsPerCell} точек на ячейку`);
    
    const usageStats = Array.from(cellUsage.entries())
      .map(([cellIndex, usage]) => ({ cellIndex, usage }))
      .sort((a, b) => b.usage - a.usage);
    
    console.log(`📈 Распределение точек по ячейкам:`);
    usageStats.forEach((stat, index) => {
      if (index < 10 || stat.usage > 0) { // Показываем топ-10 или все использованные ячейки
        const cellX = stat.cellIndex % gridSize;
        const cellY = Math.floor(stat.cellIndex / gridSize);
        console.log(`   Ячейка (${cellX},${cellY}): ${stat.usage} точек`);
      }
    });
    
    const totalUsedCells = usageStats.filter(stat => stat.usage > 0).length;
    const averagePointsPerUsedCell = generatedPoints.length / totalUsedCells;
    const maxUsage = Math.max(...usageStats.map(stat => stat.usage));
    
    console.log(`📊 Итоговая статистика:`);
    console.log(`   Использовано ячеек: ${totalUsedCells} из ${cellPoints.size}`);
    console.log(`   Среднее точек на используемую ячейку: ${averagePointsPerUsedCell.toFixed(1)}`);
    console.log(`   Максимум точек в одной ячейке: ${maxUsage}`);
    console.log(`   Равномерность: ${maxUsage <= targetPointsPerCell ? '✅ хорошая' : '⚠️ неравномерно'}`);
    
    console.log(`🚫 Статистика отклонений:`);
    console.log(`   Отклонено по недоступности графа: ${rejectedByGraph}`);
    console.log(`   Отклонено по пересечению прямого пути: ${rejectedByDirectPath}`);
    console.log(`   Всего отклонений: ${rejectedByGraph + rejectedByDirectPath}`);

    // Финальная проверка всех расстояний
    console.log(`🔍 Финальная проверка расстояний между точками:`);
    let minActualDistance = Infinity;
    let closestPair = null;
    
    for (let i = 0; i < generatedPoints.length; i++) {
      for (let j = i + 1; j < generatedPoints.length; j++) {
        const distance = haversine(
          generatedPoints[i][0], generatedPoints[i][1],
          generatedPoints[j][0], generatedPoints[j][1]
        );
        if (distance < minActualDistance) {
          minActualDistance = distance;
          closestPair = [i + 1, j + 1]; // +1 для номеров точек
        }
      }
    }
    
    console.log(`   Минимальное расстояние между точками: ${minActualDistance.toFixed(1)}м`);
    
    if (closestPair && closestPair.length >= 2) {
      console.log(`   Ближайшие точки: ${closestPair[0]} и ${closestPair[1]}`);
    } else {
      console.log(`   Недостаточно точек для сравнения расстояний`);
    }
    
    console.log(`   Целевое минимальное расстояние было: ${adaptiveMinDist.toFixed(1)}м`);
    console.log(`   Итоговое минимальное расстояние: ${currentMinDist.toFixed(1)}м`);
    
    if (closestPair && closestPair.length >= 2 && minActualDistance < currentMinDist * 0.9) {
      console.log(`⚠️ ВНИМАНИЕ: Найдены точки ближе целевого расстояния!`);
      statusCallback(`⚠️ Точки ${closestPair[0]} и ${closestPair[1]} слишком близко: ${minActualDistance.toFixed(1)}м`);
    } else {
      console.log(`✅ Все расстояния соблюдены`);
    }

    // Обновляем список точек для навигации
    updateTargetPointsList();

  } catch (error) {
    console.error('Ошибка при генерации точек:', error);
    statusCallback(`Ошибка: ${error.message}`);
  } finally {
    buttonCallback(false); // Включаем кнопку генерации
    cancelCallback(false); // Скрываем кнопку отмены
  }
}

// Функция отмены генерации
export function cancelPointGeneration() {
  cancelGeneration = true;
}
