/**
 * Модуль генерации контрольных точек на тропах
 * Основная логика генерации точек с учётом запретных зон и минимальных расстояний
 */

import { haversine, rectangleArea, extractPolygons, pointInPolygon, getRandomPointOnLine } from './utils.js';
import { fetchClosedAreas, fetchWaterAreas, fetchBarriers, fetchPaths } from './overpassAPI.js';
import { showClosedAreasOnMap, showWaterAreasOnMap, showBarriersOnMap, addPointMarker, addFailedAttemptMarker, clearPointMarkers, clearFailedAttemptMarkers, pointMarkers, getStartPoint, showGraphDebug, clearGraphDebugLayers } from './mapModule.js';
import { buildPathGraph, findNearestNodeIdx, isReachable } from './algorithms.js';
import { updateTargetPointsList } from './navigation.js';

// Переменные для отмены генерации
let cancelGeneration = false;

// Основная функция генерации точек
export async function generatePoints(selectedBounds, startPoint, count, percent, statusCallback, buttonCallback, cancelCallback) {
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
  const circleArea = area * (percent / 100);
  const minDist = Math.sqrt(circleArea / Math.PI);
  console.log(`Площадь области: ${area.toFixed(0)} м², мин. расстояние: ${minDist.toFixed(1)} м`);

  // Оценка максимального количества точек
  const Nmax = Math.floor(area / (circleArea * 1.2)); // Небольшой запас, т.к. не все 100% площади будут использованы
  if (count > Nmax) {
    statusCallback(`Слишком много точек (${count}) или слишком большой процент (${percent}%) для данной области! Максимум: ${Nmax}. Попробуйте уменьшить количество точек или процент, или увеличить область.`);
    buttonCallback(false);
    cancelCallback(false);
    return;
  }

  try {
    // Загружаем данные параллельно
    statusCallback('Загрузка закрытых зон...');
    const [closedAreasData, waterAreasData, barriersData, pathsData] = await Promise.all([
      fetchClosedAreas(selectedBounds),
      fetchWaterAreas(selectedBounds),
      fetchBarriers(selectedBounds),
      fetchPaths(selectedBounds)
    ]);

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

    if (graphResult.excludedSegments.length > 0) {
      console.log(`Исключено ${graphResult.excludedSegments.length} сегментов:`, graphResult.excludedSegments);
    }

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
    const maxAttempts = count * 50;

    while (generatedPoints.length < count && attempts < maxAttempts) {
      if (cancelGeneration) {
        statusCallback('Отменено пользователем.');
        buttonCallback(false);
        cancelCallback(false);
        return;
      }

      attempts++;

      // Выбираем случайную тропу
      const randomPath = pathsData[Math.floor(Math.random() * pathsData.length)];
      if (!randomPath.geometry || randomPath.geometry.length < 2) continue;

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
        if (haversine(lat, lon, existingPoint[0], existingPoint[1]) < minDist) {
          tooClose = true;
          break;
        }
      }

      // Проверяем расстояние до стартовой точки
      if (haversine(lat, lon, startPoint.lat, startPoint.lng) < minDist) {
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
      addPointMarker(lat, lon, generatedPoints.length);

      statusCallback(`Сгенерировано ${generatedPoints.length}/${count} точек (попыток: ${attempts})`);
      await new Promise(resolve => setTimeout(resolve, 10)); // Небольшая пауза для UI
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


