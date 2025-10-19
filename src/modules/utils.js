/**
 * Утилиты для работы с координатами и геометрией
 */

// Функция для расчёта расстояния между двумя точками (метры)
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // радиус Земли в метрах
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Функция для вычисления площади прямоугольника (метры)
export function rectangleArea(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  // ширина (по долготе, на средней широте)
  const midLat = (sw.lat + ne.lat) / 2;
  const width = haversine(midLat, sw.lng, midLat, ne.lng);
  // высота (по широте)
  const height = haversine(sw.lat, sw.lng, ne.lat, sw.lng);
  return width * height;
}

// Проверка: находится ли точка внутри полигона (алгоритм луча)
export function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]; // xi = lat, yi = lon
    const xj = polygon[j][0], yj = polygon[j][1]; // xj = lat, yj = lon
    const intersect = ((yi > lon) !== (yj > lon)) &&
      (lat < (xj - xi) * (lon - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Получить массив всех внешних полигонов (массивов координат) из areas
export function extractPolygons(areaObjs) {
  const polygons = [];
  console.log('🔍 extractPolygons: обработка', areaObjs.length, 'объектов');
  
  areaObjs.forEach((el, index) => {
    console.log(`🔍 extractPolygons: объект ${index + 1}:`, {
      type: el.type,
      hasGeometry: !!el.geometry,
      geometryLength: el.geometry ? el.geometry.length : 0,
      hasMembers: !!el.members,
      membersLength: el.members ? el.members.length : 0
    });
    
    if ((el.type === 'way' || el.type === 'closed_area') && el.geometry && el.geometry.length >= 2) {
      console.log(`🔍 extractPolygons: добавляем ${el.type} полигон с ${el.geometry.length} точками`);
      // Если только 2 точки, создаем простой отрезок как полигон
      if (el.geometry.length === 2) {
        console.log(`🔍 extractPolygons: создаем полигон из отрезка (2 точки)`);
        // Для отрезка создаем прямоугольник вокруг него
        const p1 = el.geometry[0];
        const p2 = el.geometry[1];
        const lat1 = p1.lat, lon1 = p1.lon;
        const lat2 = p2.lat, lon2 = p2.lon;
        
        console.log(`🔍 extractPolygons: координаты точек:`, {
          p1: { lat: lat1, lon: lon1 },
          p2: { lat: lat2, lon: lon2 }
        });
        
        // Проверяем валидность координат
        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
          console.warn(`🔍 extractPolygons: пропускаем невалидные координаты:`, {
            lat1, lon1, lat2, lon2
          });
          return;
        }
        
        // Создаем небольшой прямоугольник вокруг отрезка (примерно 10 метров)
        const offset = 0.0001; // примерно 10 метров
        const rect = [
          [lat1 - offset, lon1 - offset],
          [lat1 + offset, lon1 - offset],
          [lat1 + offset, lon1 + offset],
          [lat2 + offset, lon2 + offset],
          [lat2 - offset, lon2 + offset],
          [lat2 - offset, lon2 - offset],
          [lat1 - offset, lon1 - offset] // замыкаем полигон
        ];
        
        console.log(`🔍 extractPolygons: созданный прямоугольник:`, rect);
        polygons.push(rect);
      } else {
        // Валидация для многоточечных полигонов
        const validCoords = el.geometry.filter(p => 
          p && typeof p.lat === 'number' && typeof p.lon === 'number' && 
          !isNaN(p.lat) && !isNaN(p.lon)
        );
        
        if (validCoords.length >= 3) {
          console.log(`🔍 extractPolygons: добавляем многоточечный полигон с ${validCoords.length} валидными точками`);
          polygons.push(validCoords.map(p => [p.lat, p.lon]));
        } else {
          console.warn(`🔍 extractPolygons: пропускаем полигон с недостаточным количеством валидных точек: ${validCoords.length}`);
        }
      }
    }
    if (el.type === 'relation' && el.members) {
      const outers = el.members.filter(m => m.role === 'outer' && m.geometry && m.geometry.length >= 2);
      console.log(`🔍 extractPolygons: найдено ${outers.length} outer members в relation`);
      outers.forEach(outer => {
        console.log(`🔍 extractPolygons: добавляем relation полигон с ${outer.geometry.length} точками`);
        if (outer.geometry.length === 2) {
          // Аналогично для relation
          const p1 = outer.geometry[0];
          const p2 = outer.geometry[1];
          const offset = 0.0001;
          const rect = [
            [p1.lat - offset, p1.lon - offset],
            [p1.lat + offset, p1.lon - offset],
            [p1.lat + offset, p1.lon + offset],
            [p2.lat + offset, p2.lon + offset],
            [p2.lat - offset, p2.lon + offset],
            [p2.lat - offset, p2.lon - offset],
            [p1.lat - offset, p1.lon - offset]
          ];
          polygons.push(rect);
        } else {
          polygons.push(outer.geometry.map(p => [p.lat, p.lon]));
        }
      });
    }
  });
  
  console.log(`🔍 extractPolygons: итого извлечено ${polygons.length} полигонов`);
  return polygons;
}

// Проверка пересечения двух отрезков (p1,p2) и (q1,q2)
export function segmentsIntersect(p1, p2, q1, q2) {
  function ccw(a, b, c) {
    return (c.lat - a.lat) * (b.lon - a.lon) > (b.lat - a.lat) * (c.lon - a.lon);
  }
  return (ccw(p1, q1, q2) !== ccw(p2, q1, q2)) && (ccw(p1, p2, q1) !== ccw(p1, p2, q2));
}

// Проверка: пересекает ли отрезок (p1, p2) полигон (poly)
export function segmentIntersectsPolygon(p1, p2, poly) {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const q1 = {lat: poly[j][0], lon: poly[j][1]};
    const q2 = {lat: poly[i][0], lon: poly[i][1]};
    if (segmentsIntersect(p1, p2, q1, q2)) return true;
  }
  return false;
}

// Функция для вычисления расстояния от точки до отрезка
export function distancePointToSegment(point, segStart, segEnd) {
  const A = point.lat - segStart.lat;
  const B = point.lon - segStart.lon;
  const C = segEnd.lat - segStart.lat;
  const D = segEnd.lon - segStart.lon;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    // Сегмент вырожден в точку
    return haversine(point.lat, point.lon, segStart.lat, segStart.lon);
  }
  
  let t = dot / lenSq;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  
  const projection = {
    lat: segStart.lat + t * C,
    lon: segStart.lon + t * D
  };
  
  return haversine(point.lat, point.lon, projection.lat, projection.lon);
}

// Получить случайную точку на линии
export function getRandomPointOnLine(line) {
  // line: массив точек [{lat,lon}, ...]
  // 1. Выбираем случайный сегмент
  const segIdx = Math.floor(Math.random() * (line.length - 1));
  const p1 = line[segIdx];
  const p2 = line[segIdx + 1];
  // 2. Случайная точка на сегменте
  const t = Math.random();
  const lat = p1.lat + t * (p2.lat - p1.lat);
  const lon = p1.lon + t * (p2.lon - p1.lon);
  return [lat, lon];
} 