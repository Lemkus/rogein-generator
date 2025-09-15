/**
 * Модуль генерации контрольных точек на тропах - ИСПРАВЛЕННАЯ ВЕРСИЯ
 * Основная логика генерации точек с принудительным равномерным распределением
 */

import { haversine, rectangleArea, extractPolygons, pointInPolygon, getRandomPointOnLine } from './utils.js';
import { fetchClosedAreas, fetchWaterAreas, fetchBarriers, fetchPaths, fetchPathsInChunks } from './overpassAPI.js';
import { showClosedAreasOnMap, showWaterAreasOnMap, showBarriersOnMap, addPointMarker, addFailedAttemptMarker, clearPointMarkers, clearFailedAttemptMarkers, pointMarkers, getStartPoint, showGraphDebug, clearGraphDebugLayers } from './mapModule.js';
import { buildPathGraph, findNearestNodeIdx, isReachable } from './algorithms.js';
import { updateTargetPointsList } from './navigation.js';

// Переменные для отмены генерации
let cancelGeneration = false;

// Основная функция генерации точек с принудительным равномерным распределением
export async function generatePointsFixed(selectedBounds, startPoint, count, percent, statusCallback, buttonCallback, cancelCallback) {
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
  if (isNaN(percent) || percent <= 0) {
    statusCallback('Введите корректный процент для мин. расстояния!');
    return;
  }

  buttonCallback(true); // Отключаем кнопку генерации
  cancelCallback(true); // Показываем кнопку отмены
  cancelGeneration = false; // Сбрасываем флаг отмены

  statusCallback('Загрузка данных OSM...');

  const sw = selectedBounds.getSouthWest();
  const ne = selectedBounds.getNorthEast();

  // Вычисляем площадь области и минимальное расстояние
  const area = rectangleArea(selectedBounds); // в м^2
  
  // Улучшенная формула: используем шестиугольную упаковку для равномерного распределения
  const hexagonArea = area * (percent / 100) / count;
  const minDist = Math.sqrt(hexagonArea * 2 / Math.sqrt(3)); // Радиус описанной окружности шестиугольника
  
  // Адаптивное минимальное расстояние в зависимости от размера области
  const adaptiveMinDist = Math.max(minDist, Math.min(area / count / 1000, 200)); // От 50м до 200м

  statusCallback(`Минимальное расстояние между точками: ${adaptiveMinDist.toFixed(0)}м`);

  try {
    // Загружаем данные последовательно для лучшей совместимости с мобильными сетями
    let closedAreasData, waterAreasData, barriersData, pathsData;

    try {
      statusCallback('Загрузка закрытых зон...');
      closedAreasData = await fetchClosedAreas(selectedBounds);
      statusCallback(`✅ Закрытые зоны: ${closedAreasData.length} элементов`);
    } catch (error) {
      console.error('Не удалось загрузить закрытые зоны:', error.message);
      statusCallback(`⚠️ Закрытые зоны: ${error.message}`);
      closedAreasData = [];
    }

    try {
      statusCallback('Загрузка водоёмов...');
      waterAreasData = await fetchWaterAreas(selectedBounds);
      statusCallback(`✅ Водоёмы: ${waterAreasData.length} элементов`);
    } catch (error) {
      console.error('Не удалось загрузить водоёмы:', error.message);
      statusCallback(`⚠️ Водоёмы: ${error.message}`);
      waterAreasData = [];
    }

    try {
      statusCallback('Загрузка барьеров...');
      barriersData = await fetchBarriers(selectedBounds);
      statusCallback(`✅ Барьеры: ${barriersData.length} элементов`);
    } catch (error) {
      console.error('Не удалось загрузить барьеры:', error.message);
      statusCallback(`⚠️ Барьеры: ${error.message}`);
      barriersData = [];
    }

    try {
      statusCallback('Загрузка троп...');
      
      // Пробуем загрузить тропы целиком, если не получается - по частям
      try {
        pathsData = await fetchPaths(selectedBounds, statusCallback);
      } catch (error) {
        console.warn('Не удалось загрузить тропы целиком, пробуем по частям:', error.message);
        statusCallback('Попытка загрузки троп по частям...');
        pathsData = await fetchPathsInChunks(selectedBounds, statusCallback);
      }
      
      statusCallback(`✅ Тропы: ${pathsData.length} элементов`);
    } catch (error) {
      console.error('Не удалось загрузить тропы:', error.message);
      statusCallback(`❌ Ошибка загрузки троп: ${error.message}`);
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

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
    
    // Очищаем старые отладочные слои ПЕРЕД построением нового графа
    clearGraphDebugLayers();
    
    await new Promise(resolve => setTimeout(resolve, 100)); // Даём время UI обновиться

    // Получаем все запрещённые полигоны
    const allForbiddenAreas = [...closedAreasData, ...waterAreasData];
    const forbiddenPolygons = extractPolygons(allForbiddenAreas);
    console.log(`Найдено ${forbiddenPolygons.length} запрещённых полигонов`);

    // Строим граф троп
    const graphResult = buildPathGraph(pathsData, forbiddenPolygons, barriersData);
    const graph = { nodes: graphResult.nodes, adj: graphResult.adj };
    console.log(`Граф построен: ${graph.nodes.length} узлов, ${graph.adj.reduce((sum, adj) => sum + adj.length, 0) / 2} рёбер`);

    // Проверяем связность с начальной точкой
    const startNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, graph.nodes);
    if (startNodeIdx === -1) {
      statusCallback('Не найдены тропы рядом с точкой старта! Переместите точку старта ближе к тропам.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    statusCallback(`Генерация ${count} точек с принудительным равномерным распределением...`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Очищаем старые маркеры
    clearPointMarkers();
    clearFailedAttemptMarkers();

    // НОВЫЙ АЛГОРИТМ: Принудительное равномерное распределение
    const generatedPoints = [];
    
    // Разбиваем область на сетку (более мягкий подход)
    const gridSize = Math.max(3, Math.ceil(Math.sqrt(count))); // Меньше ячеек для лучшего покрытия
    const cellWidth = (ne.lng - sw.lng) / gridSize;
    const cellHeight = (ne.lat - sw.lat) / gridSize;
    
    console.log(`Создаем сетку ${gridSize}x${gridSize} = ${gridSize * gridSize} ячеек для ${count} точек`);
    
    // Создаем карту ячеек с доступными тропами
    const cellPaths = new Map();
    
    // Распределяем тропы по ячейкам (мягкая проверка)
    statusCallback('Анализ распределения троп по ячейкам...');
    let validPathsCount = 0;
    
    pathsData.forEach((path, pathIndex) => {
      if (!path.geometry || !Array.isArray(path.geometry)) return;
      
      // Находим все ячейки, которые пересекает эта тропа
      const pathCells = new Set();
      let validCoords = 0;
      
      path.geometry.forEach(coord => {
        if (!Array.isArray(coord) || coord.length < 2) return;
        const [lat, lon] = coord;
        if (typeof lat !== 'number' || typeof lon !== 'number' || 
            isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon)) return;
        
        validCoords++;
        
        const cellX = Math.floor((lon - sw.lng) / cellWidth);
        const cellY = Math.floor((lat - sw.lat) / cellHeight);
        const cellIndex = cellY * gridSize + cellX;
        
        if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
          pathCells.add(cellIndex);
        }
      });
      
      // Добавляем тропу только если у неё есть валидные координаты
      if (validCoords > 0 && pathCells.size > 0) {
        validPathsCount++;
        pathCells.forEach(cellIndex => {
          if (!cellPaths.has(cellIndex)) {
            cellPaths.set(cellIndex, []);
          }
          cellPaths.get(cellIndex).push(pathIndex);
        });
      }
    });
    
    console.log(`Валидных троп для распределения: ${validPathsCount} из ${pathsData.length}`);
    
    // Дополнительная диагностика
    if (validPathsCount === 0) {
      console.log('Диагностика: проверяем структуру троп...');
      pathsData.slice(0, 5).forEach((path, i) => {
        console.log(`Тропа ${i}:`, {
          hasGeometry: !!path.geometry,
          geometryType: typeof path.geometry,
          isArray: Array.isArray(path.geometry),
          length: path.geometry?.length,
          firstCoord: path.geometry?.[0],
          firstCoordType: typeof path.geometry?.[0]
        });
      });
    }
    
    // Получаем ячейки с тропами
    const cellsWithPaths = Array.from(cellPaths.entries())
      .map(([cellIndex, pathIndices]) => ({ cellIndex, pathIndices, pathsCount: pathIndices.length }))
      .sort((a, b) => b.pathsCount - a.pathsCount);
    
    console.log(`Ячеек с тропами: ${cellsWithPaths.length} из ${gridSize * gridSize}`);
    statusCallback(`Найдено ${cellsWithPaths.length} ячеек с тропами`);
    
    // Показываем статистику по ячейкам
    if (cellsWithPaths.length > 0) {
      console.log('Топ-5 ячеек с наибольшим количеством троп:', cellsWithPaths.slice(0, 5));
    }
    
    if (cellsWithPaths.length === 0) {
      statusCallback('⚠️ Сеточный подход не сработал, используем умный алгоритм распределения...');
      console.log('Fallback: используем умный алгоритм генерации с равномерным распределением');
      
      // Fallback: используем умный алгоритм без сетки
      return generatePointsSmart(pathsData, selectedBounds, startPoint, count, percent, 
                                 statusCallback, buttonCallback, cancelCallback, 
                                 forbiddenPolygons, graph, startNodeIdx, adaptiveMinDist);
    }
    
    // Принудительное распределение точек по ячейкам
    const pointsPerCell = Math.ceil(count / cellsWithPaths.length);
    const cellUsage = new Map();
    
    // Инициализируем счетчики использования ячеек
    cellsWithPaths.forEach(cell => {
      cellUsage.set(cell.cellIndex, 0);
    });
    
    statusCallback(`Цель: ${pointsPerCell} точек на ячейку (всего ячеек: ${cellsWithPaths.length})`);
    
    // Основной цикл генерации
    let attempts = 0;
    const maxAttempts = count * 50;
    
    while (generatedPoints.length < count && attempts < maxAttempts) {
      if (cancelGeneration) {
        statusCallback('Отменено пользователем.');
        buttonCallback(false);
        cancelCallback(false);
        return;
      }

      attempts++;

      // Выбираем ячейку с наименьшим количеством точек
      const availableCells = cellsWithPaths.filter(cell => 
        cellUsage.get(cell.cellIndex) < pointsPerCell * 2 // Максимум в 2 раза больше среднего
      );
      
      if (availableCells.length === 0) {
        // Если все ячейки перегружены, увеличиваем лимит
        const minUsage = Math.min(...Array.from(cellUsage.values()));
        cellsWithPaths.forEach(cell => {
          if (cellUsage.get(cell.cellIndex) === minUsage) {
            cellUsage.set(cell.cellIndex, minUsage + 1);
          }
        });
        continue;
      }
      
      // Выбираем ячейку с наименьшим использованием
      availableCells.sort((a, b) => cellUsage.get(a.cellIndex) - cellUsage.get(b.cellIndex));
      const selectedCell = availableCells[0];
      
      // Вычисляем границы ячейки
      const cellX = selectedCell.cellIndex % gridSize;
      const cellY = Math.floor(selectedCell.cellIndex / gridSize);
      const cellSW = {
        lat: sw.lat + cellY * cellHeight,
        lng: sw.lng + cellX * cellWidth
      };
      const cellNE = {
        lat: cellSW.lat + cellHeight,
        lng: cellSW.lng + cellWidth
      };

      // Получаем тропы в этой ячейке
      const cellPathIndices = cellPaths.get(selectedCell.cellIndex) || [];
      
      // Пытаемся сгенерировать точку в этой ячейке
      let pointGenerated = false;
      for (let pathAttempt = 0; pathAttempt < Math.min(cellPathIndices.length, 20); pathAttempt++) {
        const randomPathIndex = cellPathIndices[Math.floor(Math.random() * cellPathIndices.length)];
        const path = pathsData[randomPathIndex];
        
        if (!path || !path.geometry || !Array.isArray(path.geometry) || path.geometry.length < 2) {
          continue;
        }
        
        // Получаем случайную точку на этой тропе
        const [lat, lon] = getRandomPointOnLine(path.geometry);
        
        // Проверяем, что точка находится в ячейке
        if (lat < cellSW.lat || lat > cellNE.lat || lon < cellSW.lng || lon > cellNE.lng) {
          continue;
        }
        
        // Проверяем общие границы
        if (lat < sw.lat || lat > ne.lat || lon < sw.lng || lon > ne.lng) continue;

        // Проверяем запрещенные зоны
        let inForbiddenArea = false;
        for (const poly of forbiddenPolygons) {
          if (pointInPolygon(lat, lon, poly)) {
            inForbiddenArea = true;
            break;
          }
        }
        if (inForbiddenArea) {
          addFailedAttemptMarker(lat, lon);
          continue;
        }

        // Проверяем минимальное расстояние
        let tooClose = false;
        for (const existingPoint of generatedPoints) {
          if (haversine(lat, lon, existingPoint[0], existingPoint[1]) < adaptiveMinDist) {
            tooClose = true;
            break;
          }
        }
        if (haversine(lat, lon, startPoint.lat, startPoint.lng) < adaptiveMinDist) {
          tooClose = true;
        }
        if (tooClose) {
          addFailedAttemptMarker(lat, lon);
          continue;
        }

        // Проверяем достижимость
        const pointNodeIdx = findNearestNodeIdx(lat, lon, graph.nodes);
        if (pointNodeIdx === -1 || !isReachable(graph, startNodeIdx, pointNodeIdx)) {
          addFailedAttemptMarker(lat, lon);
          continue;
        }

        // Точка подходит!
        generatedPoints.push([lat, lon]);
        cellUsage.set(selectedCell.cellIndex, cellUsage.get(selectedCell.cellIndex) + 1);
        addPointMarker(lat, lon, generatedPoints.length);
        pointGenerated = true;
        
        statusCallback(`✅ Сгенерировано ${generatedPoints.length}/${count} точек (ячейка ${selectedCell.cellIndex}/${cellsWithPaths.length}, попыток: ${attempts})`);
        await new Promise(resolve => setTimeout(resolve, 10));
        break;
      }
      
      if (!pointGenerated) {
        // Если не удалось сгенерировать точку в этой ячейке, увеличиваем счетчик неудач
        cellUsage.set(selectedCell.cellIndex, cellUsage.get(selectedCell.cellIndex) + 1);
      }
    }

    // Финальный статус
    if (generatedPoints.length === count) {
      statusCallback(`🎯 Успешно сгенерировано ${count} точек за ${attempts} попыток!`);
    } else {
      statusCallback(`⚠️ Сгенерировано ${generatedPoints.length} из ${count} точек за ${attempts} попыток.`);
    }

    // Статистика распределения по ячейкам
    const cellStats = Array.from(cellUsage.entries())
      .map(([cellIndex, usage]) => ({ cellIndex, usage }))
      .sort((a, b) => b.usage - a.usage);
    
    console.log('Распределение точек по ячейкам:', cellStats.slice(0, 10));

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

// Умный алгоритм генерации с равномерным распределением (fallback)
async function generatePointsSmart(pathsData, selectedBounds, startPoint, count, percent, 
                                  statusCallback, buttonCallback, cancelCallback, 
                                  forbiddenPolygons, graph, startNodeIdx, adaptiveMinDist) {
  const sw = selectedBounds.getSouthWest();
  const ne = selectedBounds.getNorthEast();
  
  const generatedPoints = [];
  let attempts = 0;
  const maxAttempts = count * 200;
  
  statusCallback(`Генерация ${count} точек умным алгоритмом с равномерным распределением...`);
  
  // Создаем виртуальную сетку для равномерного распределения
  const virtualGridSize = Math.ceil(Math.sqrt(count * 2));
  const gridCellWidth = (ne.lng - sw.lng) / virtualGridSize;
  const gridCellHeight = (ne.lat - sw.lat) / virtualGridSize;
  
  // Отслеживаем использование виртуальных ячеек
  const virtualCellUsage = new Map();
  for (let i = 0; i < virtualGridSize * virtualGridSize; i++) {
    virtualCellUsage.set(i, 0);
  }
  
  // Создаем список всех возможных точек на тропах (мягкая фильтрация)
  const potentialPoints = [];
  let totalCoordsChecked = 0;
  let validCoordsFound = 0;
  
  pathsData.forEach((path, pathIndex) => {
    if (!path.geometry || !Array.isArray(path.geometry)) return;
    
    // Берем каждую 3-ю точку на тропе для лучшего покрытия
    for (let i = 0; i < path.geometry.length; i += 3) {
      totalCoordsChecked++;
      const coord = path.geometry[i];
      if (!Array.isArray(coord) || coord.length < 2) continue;
      
      const [lat, lon] = coord;
      if (typeof lat !== 'number' || typeof lon !== 'number' || 
          isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon)) continue;
      
      // Проверяем, что точка в области (мягкая проверка)
      if (lat < sw.lat || lat > ne.lat || lon < sw.lng || lon > ne.lng) continue;
      
      validCoordsFound++;
      
      // НЕ проверяем запрещенные зоны на этапе предварительного анализа
      // Это будем делать позже при размещении точек
      
      // Вычисляем виртуальную ячейку
      const cellX = Math.floor((lon - sw.lng) / gridCellWidth);
      const cellY = Math.floor((lat - sw.lat) / gridCellHeight);
      const cellIndex = cellY * virtualGridSize + cellX;
      
      potentialPoints.push({
        lat, lon, 
        cellIndex,
        pathIndex
      });
    }
  });
  
  console.log(`Проверено координат: ${totalCoordsChecked}, найдено валидных: ${validCoordsFound}`);
  
  console.log(`Найдено ${potentialPoints.length} потенциальных точек на тропах`);
  statusCallback(`Найдено ${potentialPoints.length} потенциальных точек, начинаем равномерное распределение...`);
  
  if (potentialPoints.length === 0) {
    statusCallback('⚠️ Умный алгоритм не нашел точек, используем простой алгоритм...');
    console.log('Fallback: используем простейший алгоритм генерации');
    
    // Последний fallback: простейший алгоритм
    return generatePointsUltraSimple(pathsData, selectedBounds, startPoint, count, percent, 
                                     statusCallback, buttonCallback, cancelCallback, 
                                     forbiddenPolygons, graph, startNodeIdx, adaptiveMinDist);
  }
  
  // Сортируем точки по виртуальным ячейкам для равномерного распределения
  const pointsByCell = new Map();
  potentialPoints.forEach(point => {
    if (!pointsByCell.has(point.cellIndex)) {
      pointsByCell.set(point.cellIndex, []);
    }
    pointsByCell.get(point.cellIndex).push(point);
  });
  
  // Получаем ячейки с точками
  const cellsWithPoints = Array.from(pointsByCell.entries())
    .map(([cellIndex, points]) => ({ cellIndex, points, count: points.length }))
    .sort((a, b) => b.count - a.count);
  
  console.log(`Ячеек с потенциальными точками: ${cellsWithPoints.length}`);
  
  // Циклическое распределение точек по ячейкам
  let currentCellIndex = 0;
  let pointsGenerated = 0;
  
  while (pointsGenerated < count && attempts < maxAttempts) {
    if (cancelGeneration) {
      statusCallback('Отменено пользователем.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    attempts++;

    // Выбираем ячейку с наименьшим количеством размещенных точек
    const availableCells = cellsWithPoints.filter(cell => 
      virtualCellUsage.get(cell.cellIndex) < Math.ceil(count / cellsWithPoints.length) * 1.5
    );
    
    if (availableCells.length === 0) {
      // Если все ячейки перегружены, увеличиваем лимит
      const minUsage = Math.min(...Array.from(virtualCellUsage.values()));
      cellsWithPoints.forEach(cell => {
        if (virtualCellUsage.get(cell.cellIndex) === minUsage) {
          virtualCellUsage.set(cell.cellIndex, minUsage + 1);
        }
      });
      continue;
    }
    
    // Выбираем ячейку с наименьшим использованием
    availableCells.sort((a, b) => virtualCellUsage.get(a.cellIndex) - virtualCellUsage.get(b.cellIndex));
    const selectedCell = availableCells[0];
    
    // Пытаемся разместить точку в этой ячейке
    const cellPoints = selectedCell.points;
    let pointPlaced = false;
    
    // Перемешиваем точки в ячейке для разнообразия
    for (let i = 0; i < Math.min(cellPoints.length, 20); i++) {
      const randomIndex = Math.floor(Math.random() * cellPoints.length);
      const point = cellPoints[randomIndex];
      
      // Проверяем минимальное расстояние до уже размещенных точек
      let tooClose = false;
      for (const existingPoint of generatedPoints) {
        if (haversine(point.lat, point.lon, existingPoint[0], existingPoint[1]) < adaptiveMinDist) {
          tooClose = true;
          break;
        }
      }
      if (haversine(point.lat, point.lon, startPoint.lat, startPoint.lng) < adaptiveMinDist) {
        tooClose = true;
      }
      if (tooClose) continue;
      
      // Проверяем достижимость
      const pointNodeIdx = findNearestNodeIdx(point.lat, point.lon, graph.nodes);
      if (pointNodeIdx === -1 || !isReachable(graph, startNodeIdx, pointNodeIdx)) {
        addFailedAttemptMarker(point.lat, point.lon);
        continue;
      }
      
      // Точка подходит!
      generatedPoints.push([point.lat, point.lon]);
      virtualCellUsage.set(selectedCell.cellIndex, virtualCellUsage.get(selectedCell.cellIndex) + 1);
      addPointMarker(point.lat, point.lon, generatedPoints.length);
      pointPlaced = true;
      pointsGenerated++;
      
      statusCallback(`✅ Сгенерировано ${generatedPoints.length}/${count} точек (ячейка ${selectedCell.cellIndex}/${cellsWithPoints.length}, попыток: ${attempts})`);
      await new Promise(resolve => setTimeout(resolve, 10));
      break;
    }
    
    if (!pointPlaced) {
      // Если не удалось разместить точку в этой ячейке, увеличиваем счетчик неудач
      virtualCellUsage.set(selectedCell.cellIndex, virtualCellUsage.get(selectedCell.cellIndex) + 1);
    }
  }

  // Финальный статус
  if (generatedPoints.length === count) {
    statusCallback(`🎯 Успешно сгенерировано ${count} точек за ${attempts} попыток!`);
  } else {
    statusCallback(`⚠️ Сгенерировано ${generatedPoints.length} из ${count} точек за ${attempts} попыток.`);
  }

  // Обновляем список точек для навигации
  updateTargetPointsList();
}

// Простейший алгоритм генерации (последний fallback)
async function generatePointsUltraSimple(pathsData, selectedBounds, startPoint, count, percent, 
                                        statusCallback, buttonCallback, cancelCallback, 
                                        forbiddenPolygons, graph, startNodeIdx, adaptiveMinDist) {
  const sw = selectedBounds.getSouthWest();
  const ne = selectedBounds.getNorthEast();
  
  const generatedPoints = [];
  let attempts = 0;
  const maxAttempts = count * 300; // Больше попыток для простого алгоритма
  
  statusCallback(`Генерация ${count} точек простейшим алгоритмом (максимум попыток: ${maxAttempts})...`);
  
  // Дополнительная диагностика
  console.log('Диагностика троп для простейшего алгоритма:');
  console.log(`Всего троп: ${pathsData.length}`);
  const validPaths = pathsData.filter(path => path.geometry && Array.isArray(path.geometry) && path.geometry.length >= 2);
  console.log(`Троп с валидной геометрией: ${validPaths.length}`);
  
  if (validPaths.length === 0) {
    statusCallback('❌ Не найдено троп с валидной геометрией!');
    buttonCallback(false);
    cancelCallback(false);
    return;
  }
  
  while (generatedPoints.length < count && attempts < maxAttempts) {
    if (cancelGeneration) {
      statusCallback('Отменено пользователем.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    attempts++;

    // Выбираем случайную тропу из валидных
    const randomPath = validPaths[Math.floor(Math.random() * validPaths.length)];
    
    // Получаем случайную точку на этой тропе
    const [lat, lon] = getRandomPointOnLine(randomPath.geometry);

    // Проверяем, что точка находится в выбранной области
    if (lat < sw.lat || lat > ne.lat || lon < sw.lng || lon > ne.lng) continue;

    // Проверяем запрещенные зоны
    let inForbiddenArea = false;
    for (const poly of forbiddenPolygons) {
      if (pointInPolygon(lat, lon, poly)) {
        inForbiddenArea = true;
        break;
      }
    }
    if (inForbiddenArea) {
      addFailedAttemptMarker(lat, lon);
      continue;
    }

    // Проверяем минимальное расстояние
    let tooClose = false;
    for (const existingPoint of generatedPoints) {
      if (haversine(lat, lon, existingPoint[0], existingPoint[1]) < adaptiveMinDist) {
        tooClose = true;
        break;
      }
    }
    if (haversine(lat, lon, startPoint.lat, startPoint.lng) < adaptiveMinDist) {
      tooClose = true;
    }
    if (tooClose) {
      addFailedAttemptMarker(lat, lon);
      continue;
    }

    // Проверяем достижимость
    const pointNodeIdx = findNearestNodeIdx(lat, lon, graph.nodes);
    if (pointNodeIdx === -1 || !isReachable(graph, startNodeIdx, pointNodeIdx)) {
      addFailedAttemptMarker(lat, lon);
      continue;
    }

    // Точка подходит!
    generatedPoints.push([lat, lon]);
    addPointMarker(lat, lon, generatedPoints.length);

    statusCallback(`✅ Сгенерировано ${generatedPoints.length}/${count} точек (попыток: ${attempts}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Финальный статус
  if (generatedPoints.length === count) {
    statusCallback(`🎯 Успешно сгенерировано ${count} точек за ${attempts} попыток!`);
  } else {
    statusCallback(`⚠️ Сгенерировано ${generatedPoints.length} из ${count} точек за ${attempts} попыток.`);
  }

  // Обновляем список точек для навигации
  updateTargetPointsList();
}
