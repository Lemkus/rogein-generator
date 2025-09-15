/**
 * Модуль для работы с Overpass API
 * Загружает данные из OpenStreetMap
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT = 60; // Увеличиваем таймаут для мобильных сетей

// Простой кэш для избежания повторных запросов
const queryCache = new Map();

// Определяем мобильную сеть
function isMobileNetwork() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const connection = window.navigator.connection || window.navigator.mozConnection || window.navigator.webkitConnection;
  
  // Если это мобильное устройство и соединение не 4G/5G
  return isMobile && (!connection || !connection.effectiveType?.includes('4g'));
}

// Очистка кэша
export function clearQueryCache() {
  queryCache.clear();
  console.log('Кэш Overpass API очищен');
}

// Базовая функция для выполнения запросов к Overpass API
async function executeOverpassQuery(query, errorMessage, customTimeout = TIMEOUT) {
  // Проверяем кэш
  const cacheKey = query + customTimeout;
  if (queryCache.has(cacheKey)) {
    console.log(`${errorMessage} из кэша:`, queryCache.get(cacheKey).length, 'элементов');
    return queryCache.get(cacheKey);
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), customTimeout * 1000);
    
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: query,
      headers: { 
        'Content-Type': 'text/plain',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Ошибка Overpass API (${errorMessage}):`, response.status, response.statusText, errorText);
    throw new Error(`${errorMessage}: ${response.status} ${response.statusText}. Попробуйте уменьшить область.`);
  }
  
  const data = await response.json();
    const elements = data.elements || [];
    
    // Сохраняем в кэш
    queryCache.set(cacheKey, elements);
    
    console.log(`${errorMessage} из Overpass:`, elements.length, 'элементов');
    return elements;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Таймаут Overpass API (${errorMessage})`);
      throw new Error(`${errorMessage}: Превышено время ожидания (${customTimeout}с). Попробуйте уменьшить область или использовать Wi-Fi.`);
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

  return executeOverpassQuery(query, 'Закрытые зоны', TIMEOUT);
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

  return executeOverpassQuery(query, 'Водоёмы', TIMEOUT);
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

  return executeOverpassQuery(query, 'Барьеры', TIMEOUT);
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
  const isMobile = isMobileNetwork();
  
  for (const pathType of pathTypes) {
    try {
      statusCallback(`Загрузка ${pathType.name}...`);
      
      // Специальные настройки для пешеходных троп (highway=path)
      let timeout, maxsize;
      const isPathType = pathType.type === 'path';
      
      if (isMobile && isPathType) {
        // Для мобильных сетей и пешеходных троп - очень консервативные настройки
        timeout = 30; // 30 секунд
        maxsize = 2000000; // 2 МБ максимум
        statusCallback(`📱 Мобильная сеть: ${pathType.name} (лимит 2МБ, 30с)`);
      } else if (isPathType) {
        // Для пешеходных троп на обычных сетях
        timeout = 30; // 30 секунд
        maxsize = 5000000; // 5 МБ
      } else {
        // Для остальных типов
        timeout = TIMEOUT; // 60 секунд
        maxsize = 10000000; // 10 МБ
      }
      
      // Всегда используем out geom для получения полной геометрии троп
      const query = `[out:json][timeout:${timeout}][maxsize:${maxsize}];
        way["highway"="${pathType.type}"](${bbox});
        out geom;`;

      const paths = await executeOverpassQuery(query, pathType.name, timeout);
      allPaths = allPaths.concat(paths);
      
      // Отладочная информация для пешеходных троп
      if (pathType.type === 'path' && paths.length > 0) {
        console.log(`Отладка ${pathType.name}:`, {
          count: paths.length,
          firstPath: {
            hasGeometry: !!paths[0].geometry,
            geometryType: typeof paths[0].geometry,
            isArray: Array.isArray(paths[0].geometry),
            geometryLength: paths[0].geometry?.length,
            firstCoord: paths[0].geometry?.[0],
            firstCoordType: typeof paths[0].geometry?.[0]
          }
        });
      }
      
      statusCallback(`✅ ${pathType.name}: ${paths.length} элементов`);
      
    } catch (error) {
      console.warn(`Не удалось загрузить ${pathType.name}:`, error.message);
      statusCallback(`⚠️ ${pathType.name}: ${error.message}`);
      
      // Специальная логика для пешеходных троп (highway=path)
      if (pathType.type === 'path') {
        statusCallback(`🔄 Повторная попытка загрузки ${pathType.name}...`);
        try {
          // Повторная попытка с еще более строгими лимитами для пешеходных троп
          const retryTimeout = isMobile ? 20 : 25; // Еще меньше времени
          const retryMaxsize = isMobile ? 1000000 : 2000000; // Еще меньше данных
          
          // Всегда используем out geom для повторных попыток
          const retryQuery = `[out:json][timeout:${retryTimeout}][maxsize:${retryMaxsize}];
            way["highway"="${pathType.type}"](${bbox});
            out geom;`;
          
          const retryPaths = await executeOverpassQuery(retryQuery, `${pathType.name} (повтор)`, retryTimeout);
          allPaths = allPaths.concat(retryPaths);
          statusCallback(`✅ ${pathType.name} (повтор): ${retryPaths.length} элементов`);
        } catch (retryError) {
          console.warn(`Повторная попытка не удалась:`, retryError.message);
          statusCallback(`❌ ${pathType.name}: не удалось загрузить даже с повторной попыткой`);
          
          // Последняя попытка - минимальные лимиты
          if (isMobile) {
            statusCallback(`🔄 Последняя попытка для ${pathType.name} (минимальные лимиты)...`);
            try {
              // Последняя попытка - всегда out geom
              const lastRetryQuery = `[out:json][timeout:15][maxsize:500000];
                way["highway"="${pathType.type}"](${bbox});
                out geom;`;
              
              const lastRetryPaths = await executeOverpassQuery(lastRetryQuery, `${pathType.name} (последняя попытка)`, 15);
              allPaths = allPaths.concat(lastRetryPaths);
              statusCallback(`✅ ${pathType.name} (последняя попытка): ${lastRetryPaths.length} элементов`);
            } catch (lastError) {
              console.warn(`Последняя попытка не удалась:`, lastError.message);
              statusCallback(`❌ ${pathType.name}: все попытки исчерпаны`);
            }
          }
        }
      }
    }
  }

  // Дополнительно загружаем footway=crossing
  try {
    statusCallback('Загрузка пешеходных переходов...');
    
    const query = `[out:json][timeout:${TIMEOUT}][maxsize:10000000];
      way["footway"="crossing"](${bbox});
      out geom;`;

    const crossings = await executeOverpassQuery(query, 'Пешеходные переходы', TIMEOUT);
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
        
        // Специальные настройки для пешеходных троп в частях
        const isPathType = pathType.type === 'path';
        const isMobileChunk = isMobileNetwork();
        
        let timeout, maxsize;
        if (isPathType && isMobileChunk) {
          // Для пешеходных троп на мобильных сетях в частях - очень строгие лимиты
          timeout = 15; // 15 секунд
          maxsize = 1000000; // 1 МБ максимум
          statusCallback(`📱 Часть ${i + 1}/4: ${pathType.name} (мобильная сеть, лимит 1МБ, 15с)`);
        } else if (isPathType) {
          // Для пешеходных троп в частях
          timeout = 20; // 20 секунд
          maxsize = 2000000; // 2 МБ
        } else {
          // Для остальных типов в частях
          timeout = TIMEOUT; // 60 секунд
          maxsize = 5000000; // 5 МБ
        }
        
        const query = `[out:json][timeout:${timeout}][maxsize:${maxsize}];
          way["highway"="${pathType.type}"](${bbox});
          out geom;`;

        const paths = await executeOverpassQuery(query, `Часть ${i + 1}/4: ${pathType.name}`, timeout);
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
      
      const query = `[out:json][timeout:${TIMEOUT}][maxsize:5000000];
        way["footway"="crossing"](${bbox});
    out geom;`;

      const crossings = await executeOverpassQuery(query, `Часть ${i + 1}/4: Пешеходные переходы`, TIMEOUT);
      allPaths = allPaths.concat(crossings);
      
      statusCallback(`✅ Часть ${i + 1}/4: Пешеходные переходы (${crossings.length})`);
      
    } catch (error) {
      console.warn(`Не удалось загрузить часть ${i + 1}: Пешеходные переходы:`, error.message);
      statusCallback(`⚠️ Часть ${i + 1}/4: Пешеходные переходы: ${error.message}`);
    }
  }
  
  return allPaths;
} 