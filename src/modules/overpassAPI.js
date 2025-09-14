/**
 * Модуль для работы с Overpass API
 * Загружает данные из OpenStreetMap
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT = 60; // Увеличиваем таймаут для мобильных сетей

// Базовая функция для выполнения запросов к Overpass API
async function executeOverpassQuery(query, errorMessage) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT * 1000);
    
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ошибка Overpass API (${errorMessage}):`, response.status, response.statusText, errorText);
      throw new Error(`${errorMessage}: ${response.status} ${response.statusText}. Попробуйте уменьшить область.`);
    }
    
    const data = await response.json();
    console.log(`${errorMessage} из Overpass:`, data.elements?.length || 0, 'элементов');
    return data.elements || [];
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Таймаут Overpass API (${errorMessage})`);
      throw new Error(`${errorMessage}: Превышено время ожидания (${TIMEOUT}с). Попробуйте уменьшить область или использовать Wi-Fi.`);
    }
    console.error(`Ошибка сети (${errorMessage}):`, error);
    throw new Error(`${errorMessage}: Ошибка сети. Проверьте подключение к интернету.`);
  }
}

// Загрузка закрытых зон (военные объекты, частные территории)
export async function fetchClosedAreas(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:${TIMEOUT}];
    (
      way["landuse"="military"](${bbox});
      relation["landuse"="military"](${bbox});
      way["military"](${bbox});
      relation["military"](${bbox});
      way["access"="private"](${bbox});
      relation["access"="private"](${bbox});
    );
    out geom;`;

  return executeOverpassQuery(query, 'Закрытые зоны');
}

// Загрузка водоёмов
export async function fetchWaterAreas(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:${TIMEOUT}];
    (
      way["natural"="water"](${bbox});
      relation["natural"="water"](${bbox});
      way["water"="lake"](${bbox});
      relation["water"="lake"](${bbox});
      way["landuse"="reservoir"](${bbox});
      relation["landuse"="reservoir"](${bbox});
      way["landuse"="basin"](${bbox});
      relation["landuse"="basin"](${bbox});
    );
    out geom;`;

  return executeOverpassQuery(query, 'Водоёмы');
}

// Загрузка барьеров - только ЯВНО ЗАПРЕЩЁННЫЕ
export async function fetchBarriers(bounds) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  const query = `[
    out:json][timeout:${TIMEOUT}];
    (
      // ТОЛЬКО элементы с ЯВНЫМ запретом доступа
      way["access"="no"](${bbox});
      way["access"="private"](${bbox});
      way["foot"="no"](${bbox});
      node["access"="no"](${bbox});
      node["access"="private"](${bbox});
      node["foot"="no"](${bbox});
      relation["access"="no"](${bbox});
      relation["access"="private"](${bbox});
      relation["foot"="no"](${bbox});
      
      // Стены - обычно непроходимы по определению
      way["barrier"="wall"](${bbox});
    );
    out geom;`;

  return executeOverpassQuery(query, 'Барьеры');
}

// Загрузка пешеходных путей и дорог по типам
export async function fetchPaths(bounds, statusCallback) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  let allPaths = [];
  
  // Список типов дорог для загрузки
  const pathTypes = [
    { type: 'path', name: 'Пешеходные тропы' },
    { type: 'footway', name: 'Пешеходные дорожки' },
    { type: 'cycleway', name: 'Велосипедные дорожки' },
    { type: 'track', name: 'Полевые дороги' },
    { type: 'service', name: 'Служебные дороги' },
    { type: 'bridleway', name: 'Конные тропы' },
    { type: 'unclassified', name: 'Неклассифицированные дороги' },
    { type: 'residential', name: 'Жилые улицы' },
    { type: 'living_street', name: 'Жилые зоны' },
    { type: 'steps', name: 'Лестницы' },
    { type: 'pedestrian', name: 'Пешеходные зоны' }
    // Примечание: crossing загружается отдельно как footway=crossing
  ];

  // Загружаем каждый тип отдельно
  for (const pathType of pathTypes) {
    try {
      statusCallback(`Загрузка ${pathType.name}...`);
      
      // Для пешеходных троп используем более строгие лимиты
      const isPathType = pathType.type === 'path';
      const timeout = isPathType ? 30 : TIMEOUT; // 30 сек для path, 60 для остальных
      const maxsize = isPathType ? 5000000 : 10000000; // 5 МБ для path, 10 МБ для остальных
      
      const query = `[
        out:json][timeout:${timeout}][maxsize:${maxsize}];
        way["highway"="${pathType.type}"](${bbox});
        out geom;`;

      const paths = await executeOverpassQuery(query, pathType.name);
      allPaths = allPaths.concat(paths);
      
      statusCallback(`✅ ${pathType.name}: ${paths.length} элементов`);
      
    } catch (error) {
      console.warn(`Не удалось загрузить ${pathType.name}:`, error.message);
      statusCallback(`⚠️ ${pathType.name}: ${error.message}`);
    }
  }

  // Дополнительно загружаем footway=crossing
  try {
    statusCallback('Загрузка пешеходных переходов...');
    
    const query = `[
      out:json][timeout:${TIMEOUT}][maxsize:10000000];
      way["footway"="crossing"](${bbox});
      out geom;`;

    const crossings = await executeOverpassQuery(query, 'Пешеходные переходы');
    allPaths = allPaths.concat(crossings);
    
    statusCallback(`✅ Пешеходные переходы: ${crossings.length} элементов`);
    
  } catch (error) {
    console.warn('Не удалось загрузить пешеходные переходы:', error.message);
    statusCallback(`⚠️ Пешеходные переходы: ${error.message}`);
  }

  return allPaths;
}

// Загрузка троп по частям для больших областей
export async function fetchPathsInChunks(bounds, statusCallback) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  
  // Разбиваем область на 4 части
  const midLat = (s + n) / 2;
  const midLng = (w + e) / 2;
  
  const chunks = [
    { s, w, n: midLat, e: midLng }, // Юго-запад
    { s, w: midLng, n: midLat, e }, // Юго-восток
    { s: midLat, w, n, e: midLng }, // Северо-запад
    { s: midLat, w: midLng, n, e }  // Северо-восток
  ];
  
  let allPaths = [];
  
  // Список типов дорог для загрузки
  const pathTypes = [
    { type: 'path', name: 'Пешеходные тропы' },
    { type: 'footway', name: 'Пешеходные дорожки' },
    { type: 'cycleway', name: 'Велосипедные дорожки' },
    { type: 'track', name: 'Полевые дороги' },
    { type: 'service', name: 'Служебные дороги' },
    { type: 'bridleway', name: 'Конные тропы' },
    { type: 'unclassified', name: 'Неклассифицированные дороги' },
    { type: 'residential', name: 'Жилые улицы' },
    { type: 'living_street', name: 'Жилые зоны' },
    { type: 'steps', name: 'Лестницы' },
    { type: 'pedestrian', name: 'Пешеходные зоны' }
    // Примечание: crossing загружается отдельно как footway=crossing
  ];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const bbox = `${chunk.s},${chunk.w},${chunk.n},${chunk.e}`;
    
    statusCallback(`Загрузка части ${i + 1}/4...`);
    
    // Загружаем каждый тип троп в этой части
    for (const pathType of pathTypes) {
      try {
        statusCallback(`Часть ${i + 1}/4: ${pathType.name}...`);
        
        // Для пешеходных троп используем еще более строгие лимиты в частях
        const isPathType = pathType.type === 'path';
        const timeout = isPathType ? 20 : TIMEOUT; // 20 сек для path, 60 для остальных
        const maxsize = isPathType ? 2000000 : 5000000; // 2 МБ для path, 5 МБ для остальных
        
        const query = `[
          out:json][timeout:${timeout}][maxsize:${maxsize}];
          way["highway"="${pathType.type}"](${bbox});
          out geom;`;

        const paths = await executeOverpassQuery(query, `Часть ${i + 1}/4: ${pathType.name}`);
        allPaths = allPaths.concat(paths);
        
        statusCallback(`✅ Часть ${i + 1}/4: ${pathType.name} (${paths.length})`);
        
      } catch (error) {
        console.warn(`Не удалось загрузить часть ${i + 1}: ${pathType.name}:`, error.message);
        statusCallback(`⚠️ Часть ${i + 1}/4: ${pathType.name}: ${error.message}`);
      }
    }
    
    // Дополнительно загружаем footway=crossing для этой части
    try {
      statusCallback(`Часть ${i + 1}/4: Пешеходные переходы...`);
      
      const query = `[
        out:json][timeout:${TIMEOUT}][maxsize:5000000];
        way["footway"="crossing"](${bbox});
        out geom;`;

      const crossings = await executeOverpassQuery(query, `Часть ${i + 1}/4: Пешеходные переходы`);
      allPaths = allPaths.concat(crossings);
      
      statusCallback(`✅ Часть ${i + 1}/4: Пешеходные переходы (${crossings.length})`);
      
    } catch (error) {
      console.warn(`Не удалось загрузить часть ${i + 1}: Пешеходные переходы:`, error.message);
      statusCallback(`⚠️ Часть ${i + 1}/4: Пешеходные переходы: ${error.message}`);
    }
  }
  
  return allPaths;
} 