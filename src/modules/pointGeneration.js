/**
 * Модуль генерации контрольных точек на тропах
 * Основная логика генерации точек с учётом запретных зон и минимальных расстояний
 */

import { haversine, rectangleArea, extractPolygons, pointInPolygon, getRandomPointOnLine } from './utils.js';
import { fetchClosedAreas, fetchWaterAreas, fetchBarriers, fetchPaths, fetchPathsInChunks } from './overpassAPI.js';
import { showClosedAreasOnMap, showWaterAreasOnMap, showBarriersOnMap, addPointMarker, addFailedAttemptMarker, clearPointMarkers, clearFailedAttemptMarkers, pointMarkers, getStartPoint, showGraphDebug, clearGraphDebugLayers } from './mapModule.js';
import { buildPathGraph, findNearestNodeIdx, isReachable } from './algorithms.js';
import { updateTargetPointsList } from './navigation.js';

// Переменные для отмены генерации
let cancelGeneration = false;

// Основная функция генерации точек - ВРЕМЕННО ОТКЛЮЧЕНА
export async function generatePoints_OLD(selectedBounds, startPoint, count, percent, statusCallback, buttonCallback, cancelCallback) {
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
  // Каждая точка занимает площадь в виде правильного шестиугольника
  const hexagonArea = area * (percent / 100) / count;
  const minDist = Math.sqrt(hexagonArea * 2 / Math.sqrt(3)); // Радиус описанной окружности шестиугольника
  
  // Альтернативная формула: квадратная сетка (более консервативная)
  const gridMinDist = Math.sqrt(area * (percent / 100) / count);
  
  // Выбираем большее значение для лучшего распределения
  const finalMinDist = Math.max(minDist, gridMinDist);
  
  // Дополнительная оптимизация: увеличиваем минимальное расстояние для больших областей
  const adaptiveMinDist = finalMinDist * (1 + Math.log10(area / 1000000) * 0.1); // +10% на каждый км²
  
  console.log(`Площадь области: ${area.toFixed(0)} м², мин. расстояние: ${adaptiveMinDist.toFixed(1)} м (шестиугольная упаковка: ${minDist.toFixed(1)} м, сетка: ${gridMinDist.toFixed(1)} м, адаптивное: ${adaptiveMinDist.toFixed(1)} м)`);

  // Оценка максимального количества точек
  const circleArea = area * (percent / 100);
  const Nmax = Math.floor(area / (circleArea * 1.2)); // Небольшой запас, т.к. не все 100% площади будут использованы
  if (count > Nmax) {
    statusCallback(`Слишком много точек (${count}) или слишком большой процент (${percent}%) для данной области! Максимум: ${Nmax}. Попробуйте уменьшить количество точек или процент, или увеличить область.`);
    buttonCallback(false);
    cancelCallback(false);
    return;
  }

  try {
    // Загружаем данные последовательно для лучшей работы на мобильных сетях
    let closedAreasData = [];
    let waterAreasData = [];
    let barriersData = [];
    let pathsData = [];
    
    // Загружаем закрытые зоны (критично)
    try {
      statusCallback('Загрузка закрытых зон...');
      closedAreasData = await fetchClosedAreas(selectedBounds);
    } catch (error) {
      console.warn('Не удалось загрузить закрытые зоны:', error.message);
      statusCallback('⚠️ Закрытые зоны пропущены (ошибка сети)');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Пауза для показа сообщения
    }
    
    if (cancelGeneration) {
      statusCallback('Отменено пользователем.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }
    
    // Загружаем водоёмы (критично)
    try {
      statusCallback('Загрузка водоёмов...');
      waterAreasData = await fetchWaterAreas(selectedBounds);
    } catch (error) {
      console.warn('Не удалось загрузить водоёмы:', error.message);
      statusCallback('⚠️ Водоёмы пропущены (ошибка сети)');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (cancelGeneration) {
      statusCallback('Отменено пользователем.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }
    
    // Загружаем барьеры (не критично)
    try {
      statusCallback('Загрузка барьеров...');
      barriersData = await fetchBarriers(selectedBounds);
    } catch (error) {
      console.warn('Не удалось загрузить барьеры:', error.message);
      statusCallback('⚠️ Барьеры пропущены (ошибка сети)');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (cancelGeneration) {
      statusCallback('Отменено пользователем.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }
    
    // Загружаем тропы (критично - без них генерация невозможна)
    try {
      statusCallback('Загрузка троп...');
      
      // Проверяем размер области - если слишком большая, разбиваем на части
      const area = rectangleArea(selectedBounds);
      const maxArea = 10000000; // 10 км²
      
      if (area > maxArea) {
        statusCallback('⚠️ Большая область - загружаем тропы по частям...');
        pathsData = await fetchPathsInChunks(selectedBounds, statusCallback);
      } else {
        pathsData = await fetchPaths(selectedBounds, statusCallback);
      }
      
      if (pathsData.length === 0) {
        throw new Error('В выбранной области не найдено троп. Попробуйте выбрать другую область.');
      }
      
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
    
    // Отладочная информация о структуре данных троп
    console.log('Отладка структуры троп:');
    console.log(`Всего троп: ${pathsData.length}`);
    console.log('Примеры структуры троп:');
    pathsData.slice(0, 3).forEach((path, i) => {
      console.log(`Тропа ${i}:`, {
        hasGeometry: !!path.geometry,
        geometryType: typeof path.geometry,
        isArray: Array.isArray(path.geometry),
        geometryLength: path.geometry?.length,
        firstElement: path.geometry?.[0],
        firstElementType: typeof path.geometry?.[0],
        firstElementIsArray: Array.isArray(path.geometry?.[0])
      });
    });
    
    // Детальный анализ проблемных троп
    const problematicPaths = pathsData.filter(path => {
      if (!path.geometry || !Array.isArray(path.geometry)) return true;
      return path.geometry.some(coord => !Array.isArray(coord) || coord.length < 2);
    });
    
    if (problematicPaths.length > 0) {
      console.warn(`Найдено ${problematicPaths.length} проблемных троп с некорректной структурой geometry`);
      
      // Анализируем типы проблем
      const problemTypes = {
        noGeometry: 0,
        notArray: 0,
        shortCoords: 0,
        invalidCoords: 0
      };
      
      problematicPaths.forEach(path => {
        if (!path.geometry) {
          problemTypes.noGeometry++;
        } else if (!Array.isArray(path.geometry)) {
          problemTypes.notArray++;
        } else {
          path.geometry.forEach(coord => {
            if (!Array.isArray(coord)) {
              problemTypes.notArray++;
            } else if (coord.length < 2) {
              problemTypes.shortCoords++;
            } else {
              const [lat, lon] = coord;
              if (typeof lat !== 'number' || typeof lon !== 'number' || 
                  isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon)) {
                problemTypes.invalidCoords++;
              }
            }
          });
        }
      });
      
      console.log('Типы проблем:', problemTypes);
      console.log('Примеры проблемных троп:', problematicPaths.slice(0, 2));
    }

    if (graphResult.excludedSegments.length > 0) {
      console.log(`Исключено ${graphResult.excludedSegments.length} сегментов:`, graphResult.excludedSegments);
    }
    
    // Смягченная фильтрация троп - принимаем больше троп
    const validPathsData = pathsData.filter(path => {
      // Базовая проверка
      if (!path.geometry || !Array.isArray(path.geometry) || path.geometry.length < 2) return false;
      
      // Проверяем, что хотя бы большинство элементов geometry являются корректными
      try {
        let validCoords = 0;
        let totalCoords = path.geometry.length;
        
        path.geometry.forEach(coord => {
          if (Array.isArray(coord) && coord.length >= 2) {
            const [lat, lon] = coord;
            if (typeof lat === 'number' && typeof lon === 'number' && 
                !isNaN(lat) && !isNaN(lon) && isFinite(lat) && isFinite(lon)) {
              validCoords++;
            }
          }
        });
        
        // Принимаем тропу, если хотя бы 80% координат валидны
        return validCoords >= Math.max(2, totalCoords * 0.8);
      } catch (error) {
        console.warn('Ошибка при проверке тропы:', error, path.geometry);
        return false;
      }
    });
    
    console.log(`Отфильтровано ${pathsData.length - validPathsData.length} проблемных троп. Осталось ${validPathsData.length} корректных троп.`);
    
    // Если отфильтровано слишком много троп, используем исходные данные с мягкими проверками
    let pathsDataForGeneration;
    const filterRatio = validPathsData.length / pathsData.length;
    
    if (filterRatio < 0.5) {
      console.warn(`Отфильтровано слишком много троп (${(1-filterRatio)*100}%). Используем исходные данные с мягкими проверками.`);
      pathsDataForGeneration = pathsData.filter(path => {
        // Минимальные проверки - только базовая структура
        return path.geometry && Array.isArray(path.geometry) && path.geometry.length >= 2;
      });
      console.log(`Используем ${pathsDataForGeneration.length} троп с мягкими проверками.`);
    } else {
      pathsDataForGeneration = validPathsData;
    }
    
    // Дополнительная проверка для пешеходных троп
    const pathTypeCounts = {};
    pathsDataForGeneration.forEach(path => {
      const highway = path.tags?.highway || 'unknown';
      pathTypeCounts[highway] = (pathTypeCounts[highway] || 0) + 1;
    });
    console.log('Распределение типов троп:', pathTypeCounts);

    // --- Отладочная визуализация графа троп ---
    statusCallback('Отображение отладочной визуализации графа...');
    showGraphDebug(graph);
    console.log('Отладочная визуализация графа троп включена (фиолетовые узлы и рёбра)');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Проверяем связность с начальной точкой
    const startNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, graph.nodes);
    if (startNodeIdx === -1) {
      statusCallback('Не найдены тропы рядом с точкой старта! Переместите точку старта ближе к тропам.');
      buttonCallback(false);
      cancelCallback(false);
      return;
    }

    statusCallback(`Генерация ${count} точек...`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Очищаем старые маркеры (НО НЕ отладочные слои графа!)
    clearPointMarkers();
    clearFailedAttemptMarkers();

    const generatedPoints = [];
    let attempts = 0;
    const maxAttempts = count * 100; // Увеличиваем количество попыток для лучшего распределения

    // Новый подход: принудительное равномерное распределение
    // Разбиваем область на сетку, где каждая ячейка должна содержать примерно равное количество точек
    const gridSize = Math.ceil(Math.sqrt(count * 2)); // Сетка больше чем точек
    const cellWidth = (ne.lng - sw.lng) / gridSize;
    const cellHeight = (ne.lat - sw.lat) / gridSize;
    
    // Создаем карту ячеек с доступными тропами
    const cellPaths = new Map();
    const totalCells = gridSize * gridSize;
    
    // Предварительно распределяем тропы по ячейкам
    console.log('Распределение троп по ячейкам...');
    pathsDataForGeneration.forEach((path, pathIndex) => {
      if (!path.geometry || !Array.isArray(path.geometry)) return;
      
      // Находим все ячейки, которые пересекает эта тропа
      const pathCells = new Set();
      
      path.geometry.forEach(coord => {
        if (!Array.isArray(coord) || coord.length < 2) return;
        const [lat, lon] = coord;
        if (typeof lat !== 'number' || typeof lon !== 'number' || 
            isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon)) return;
        
        const cellX = Math.floor((lon - sw.lng) / cellWidth);
        const cellY = Math.floor((lat - sw.lat) / cellHeight);
        const cellIndex = cellY * gridSize + cellX;
        
        if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
          pathCells.add(cellIndex);
        }
      });
      
      // Добавляем тропу во все пересекаемые ячейки
      pathCells.forEach(cellIndex => {
        if (!cellPaths.has(cellIndex)) {
          cellPaths.set(cellIndex, []);
        }
        cellPaths.get(cellIndex).push(pathIndex);
      });
    });
    
    console.log(`Ячеек с тропами: ${cellPaths.size} из ${totalCells}`);
    
    // Создаем список ячеек с тропами, отсортированный по количеству троп
    const cellsWithPaths = Array.from(cellPaths.entries())
      .map(([cellIndex, pathIndices]) => ({ cellIndex, pathIndices, pathsCount: pathIndices.length }))
      .sort((a, b) => b.pathsCount - a.pathsCount); // Больше троп = выше приоритет
    
    console.log('Топ-10 ячеек с наибольшим количеством троп:', cellsWithPaths.slice(0, 10));

    // Новый алгоритм: циклическое прохождение по ячейкам
    const pointsPerCell = Math.ceil(count / cellsWithPaths.length);
    const cellUsage = new Map(); // Отслеживаем использование каждой ячейки
    
    // Инициализируем счетчики использования ячеек
    cellsWithPaths.forEach(cell => {
      cellUsage.set(cell.cellIndex, 0);
    });

    // Основной цикл генерации с принудительным распределением
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

      // Сначала выбираем зону с наименьшим количеством точек
      zonePriorities.sort((a, b) => a.usage - b.usage);
      
      // Выбираем одну из наименее загруженных зон (топ 30%)
      const targetZones = zonePriorities.slice(0, Math.max(1, Math.floor(zonePriorities.length * 0.3)));
      const selectedZone = targetZones[Math.floor(Math.random() * targetZones.length)];
      
      // Вычисляем границы выбранной зоны
      const zoneX = selectedZone.index % zoneCount;
      const zoneY = Math.floor(selectedZone.index / zoneCount);
      const zoneSW = {
        lat: sw.lat + zoneY * zoneHeight,
        lng: sw.lng + zoneX * zoneWidth
      };
      const zoneNE = {
        lat: zoneSW.lat + zoneHeight,
        lng: zoneSW.lng + zoneWidth
      };

      // Ищем тропы в этой зоне (мягкие проверки)
      const pathsInZone = pathsDataForGeneration.filter(path => {
        if (!path.geometry || !Array.isArray(path.geometry) || path.geometry.length < 2) return false;
        
        // Мягкая проверка - ищем хотя бы одну валидную координату в зоне
        try {
          return path.geometry.some(coord => {
            if (!Array.isArray(coord) || coord.length < 2) return false;
            const [lat, lon] = coord;
            if (typeof lat !== 'number' || typeof lon !== 'number' || 
                isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon)) return false;
            return lat >= zoneSW.lat && lat <= zoneNE.lat && 
                   lon >= zoneSW.lng && lon <= zoneNE.lng;
          });
        } catch (error) {
          console.warn('Ошибка при обработке geometry тропы:', error, path.geometry);
          return false;
        }
      });

      if (pathsInZone.length === 0) {
        // Если в зоне нет троп, переходим к следующей попытке
        continue;
      }

      // Выбираем случайную тропу из этой зоны
      const randomPath = pathsInZone[Math.floor(Math.random() * pathsInZone.length)];
      
      // Проверяем, что geometry действительно массив
      if (!randomPath.geometry || !Array.isArray(randomPath.geometry) || randomPath.geometry.length < 2) {
        continue;
      }
      
      // Получаем случайную точку на этой тропе
      const [lat, lon] = getRandomPointOnLine(randomPath.geometry);

      // Проверяем, что точка находится в выбранной области
      if (lat < sw.lat || lat > ne.lat || lon < sw.lng || lon > ne.lng) continue;

      // Проверяем, что точка не в запрещённой зоне
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

      // Проверяем минимальное расстояние до уже сгенерированных точек
      let tooClose = false;
      for (const existingPoint of generatedPoints) {
        if (haversine(lat, lon, existingPoint[0], existingPoint[1]) < adaptiveMinDist) {
          tooClose = true;
          break;
        }
      }

      // Проверяем расстояние до стартовой точки
      if (haversine(lat, lon, startPoint.lat, startPoint.lng) < adaptiveMinDist) {
        tooClose = true;
      }

      if (tooClose) {
        addFailedAttemptMarker(lat, lon);
        continue;
      }

      // Проверяем достижимость от стартовой точки
      const pointNodeIdx = findNearestNodeIdx(lat, lon, graph.nodes);
      if (pointNodeIdx === -1 || !isReachable(graph, startNodeIdx, pointNodeIdx)) {
        addFailedAttemptMarker(lat, lon);
        continue;
      }

      // Точка подходит!
      generatedPoints.push([lat, lon]);
      
      // Обновляем счетчики зон
      const finalZoneX = Math.floor((lon - sw.lng) / zoneWidth);
      const finalZoneY = Math.floor((lat - sw.lat) / zoneHeight);
      const finalZoneIndex = finalZoneY * zoneCount + finalZoneX;
      zonesUsed[finalZoneIndex]++;
      
      // Обновляем приоритеты зон
      const zonePriority = zonePriorities.find(p => p.index === finalZoneIndex);
      if (zonePriority) {
        zonePriority.usage++;
      }
      
      addPointMarker(lat, lon, generatedPoints.length);

      statusCallback(`Сгенерировано ${generatedPoints.length}/${count} точек (попыток: ${attempts})`);
      await new Promise(resolve => setTimeout(resolve, 10)); // Небольшая пауза для UI
    }

    // Если не удалось сгенерировать все точки, пробуем принудительное распределение
    if (generatedPoints.length < count) {
      statusCallback(`Попытка принудительного распределения оставшихся точек...`);
      
      // Находим зоны с наименьшим количеством точек
      const emptyZones = [];
      for (let i = 0; i < zonesUsed.length; i++) {
        if (zonesUsed[i] === 0) {
          const zoneX = i % zoneCount;
          const zoneY = Math.floor(i / zoneCount);
          emptyZones.push({ index: i, x: zoneX, y: zoneY });
        }
      }
      
      // Пытаемся разместить точки в пустых зонах
      for (const emptyZone of emptyZones) {
        if (generatedPoints.length >= count) break;
        
        const zoneSW = {
          lat: sw.lat + emptyZone.y * zoneHeight,
          lng: sw.lng + emptyZone.x * zoneWidth
        };
        const zoneNE = {
          lat: zoneSW.lat + zoneHeight,
          lng: zoneSW.lng + zoneWidth
        };
        
        // Ищем тропы в этой зоне
        const pathsInEmptyZone = pathsDataForGeneration.filter(path => {
          if (!path.geometry || !Array.isArray(path.geometry) || path.geometry.length < 2) return false;
          
          // Проверяем, что каждый элемент geometry является массивом с координатами
          try {
            return path.geometry.some(coord => {
              if (!Array.isArray(coord) || coord.length < 2) return false;
              const [lat, lon] = coord;
              if (typeof lat !== 'number' || typeof lon !== 'number') return false;
              return lat >= zoneSW.lat && lat <= zoneNE.lat && 
                     lon >= zoneSW.lng && lon <= zoneNE.lng;
            });
          } catch (error) {
            console.warn('Ошибка при обработке geometry тропы в пустой зоне:', error, path.geometry);
            return false;
          }
        });
        
        if (pathsInEmptyZone.length > 0) {
          // Пытаемся найти подходящую точку в этой зоне
          for (let attempt = 0; attempt < 50; attempt++) {
            const randomPath = pathsInEmptyZone[Math.floor(Math.random() * pathsInEmptyZone.length)];
            
            // Проверяем, что geometry действительно массив
            if (!randomPath.geometry || !Array.isArray(randomPath.geometry) || randomPath.geometry.length < 2) {
              continue;
            }
            
            const [lat, lon] = getRandomPointOnLine(randomPath.geometry);
            
            // Проверяем все условия
            if (lat < sw.lat || lat > ne.lat || lon < sw.lng || lon > ne.lng) continue;
            
            // Проверяем запрещенные зоны
            let inForbiddenArea = false;
            for (const poly of forbiddenPolygons) {
              if (pointInPolygon(lat, lon, poly)) {
                inForbiddenArea = true;
                break;
              }
            }
            if (inForbiddenArea) continue;
            
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
            if (tooClose) continue;
            
            // Проверяем достижимость
            const pointNodeIdx = findNearestNodeIdx(lat, lon, graph.nodes);
            if (pointNodeIdx === -1 || !isReachable(graph, startNodeIdx, pointNodeIdx)) continue;
            
            // Точка подходит!
            generatedPoints.push([lat, lon]);
            zonesUsed[emptyZone.index]++;
            addPointMarker(lat, lon, generatedPoints.length);
            
            statusCallback(`Принудительно добавлена точка в пустую зону: ${generatedPoints.length}/${count}`);
            break;
          }
        }
      }
    }

    // Финальный статус
    if (generatedPoints.length === count) {
      statusCallback(`✅ Успешно сгенерировано ${count} точек за ${attempts} попыток!`);
    } else {
      statusCallback(`⚠️ Сгенерировано только ${generatedPoints.length}/${count} точек за ${attempts} попыток. Попробуйте уменьшить процент или количество точек.`);
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

// Функция для отмены генерации
export function cancelPointGeneration() {
  cancelGeneration = true;
}

// НОВАЯ функция генерации точек с принудительным равномерным распределением
export async function generatePoints(selectedBounds, startPoint, count, percent, statusCallback, buttonCallback, cancelCallback) {
  // Импортируем исправленную функцию
  const { generatePointsFixed } = await import('./pointGeneration_fixed.js');
  return generatePointsFixed(selectedBounds, startPoint, count, percent, statusCallback, buttonCallback, cancelCallback);
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
    <name>CP${pointNumber}</name>
    <type>MILE MARKER</type>
  </wpt>
`;
  });

  // Добавляем трек между всеми точками для Garmin
  gpxContent += `
  <trk>
    <name>Trail Route</name>
    <trkseg>`;
  
  // Добавляем стартовую точку в трек
  if (startPoint) {
    gpxContent += `
      <trkpt lat="${startPoint.lat.toFixed(14)}" lon="${startPoint.lng.toFixed(14)}">
        <ele>0.0</ele>
      </trkpt>`;
  }
  
  // Добавляем все контрольные точки в трек
  pointMarkers.forEach((marker, i) => {
    const latlng = marker.getLatLng();
    gpxContent += `
      <trkpt lat="${latlng.lat.toFixed(14)}" lon="${latlng.lng.toFixed(14)}">
        <ele>0.0</ele>
      </trkpt>`;
  });
  
  gpxContent += `
    </trkseg>
  </trk>
</gpx>`;

  // Создаём и скачиваем файл
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trail_points.gpx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
} 


