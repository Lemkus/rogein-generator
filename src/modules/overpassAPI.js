/**
 * Модуль для работы с Overpass API и OSMnx Backend
 * Загружает данные из OpenStreetMap с fallback на OSMnx backend
 */

import { 
  isOSMnxBackendAvailable, 
  fetchPathsWithOSMnx, 
  fetchBarriersWithOSMnx, 
  fetchAllWithOSMnx,
  getBboxString 
} from './osmnxAPI.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT = 60; // Увеличиваем таймаут для мобильных сетей

// Простой кэш для избежания повторных запросов
const queryCache = new Map();

// Флаг доступности OSMnx backend (кэшируется на время сессии)
let osmnxAvailable = null;

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

/**
 * Проверяет доступность OSMnx backend с кэшированием
 * @returns {Promise<boolean>}
 */
async function checkOSMnxAvailability() {
  if (osmnxAvailable === null) {
    console.log('🔍 Проверяем доступность OSMnx backend...');
    osmnxAvailable = await isOSMnxBackendAvailable();
    
    if (osmnxAvailable) {
      console.log('✅ OSMnx backend доступен - будет использован для загрузки данных');
    } else {
      console.log('⚠️ OSMnx backend недоступен - используется Overpass API');
    }
  }
  
  return osmnxAvailable;
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
  // Сначала пытаемся использовать OSMnx backend
  if (await checkOSMnxAvailability()) {
    try {
      const bbox = getBboxString(bounds);
      console.log('🚀 Загрузка закрытых зон через OSMnx backend...');
      
      // OSMnx backend пока не поддерживает закрытые зоны, используем Overpass API
      console.log('⚠️ OSMnx не поддерживает закрытые зоны, используем Overpass API');
    } catch (error) {
      console.log('❌ Ошибка OSMnx backend для закрытых зон:', error.message);
    }
  }

  // Fallback на Overpass API
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
  // Сначала пытаемся использовать OSMnx backend
  if (await checkOSMnxAvailability()) {
    try {
      const bbox = getBboxString(bounds);
      console.log('🚀 Загрузка водоёмов через OSMnx backend...');
      
      // OSMnx backend пока не поддерживает водоёмы, используем Overpass API
      console.log('⚠️ OSMnx не поддерживает водоёмы, используем Overpass API');
    } catch (error) {
      console.log('❌ Ошибка OSMnx backend для водоёмов:', error.message);
    }
  }

  // Fallback на Overpass API
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
  // Сначала пытаемся использовать OSMnx backend
  if (await checkOSMnxAvailability()) {
    try {
      const bbox = getBboxString(bounds);
      console.log('🚀 Загрузка барьеров через OSMnx backend...');
      
      const barriers = await fetchBarriersWithOSMnx(bbox);
      
      if (barriers.length > 0) {
        console.log(`✅ OSMnx: загружено ${barriers.length} барьеров`);
        return barriers;
      } else {
        console.log('⚠️ OSMnx вернул пустой результат для барьеров, переключаемся на Overpass API');
      }
    } catch (error) {
      console.log('❌ Ошибка OSMnx backend для барьеров, переключаемся на Overpass API:', error.message);
    }
  }

  // Fallback на Overpass API
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

// Оптимизированная загрузка путей с группировкой запросов
async function fetchPathsGrouped(bounds, statusCallback) {
  const s = bounds.getSouth();
  const w = bounds.getWest();
  const n = bounds.getNorth();
  const e = bounds.getEast();
  const bbox = `${s},${w},${n},${e}`;

  let allPaths = [];
  const isMobile = isMobileNetwork();
  
  // Группируем типы дорог для сокращения количества запросов
  const pathGroups = [
    {
      name: 'Основные пешеходные маршруты',
      types: ['path', 'footway', 'cycleway'],
      priority: 'high'
    },
    {
      name: 'Дороги и тропы',
      types: ['track', 'service', 'bridleway'],
      priority: 'medium'
    },
    {
      name: 'Городские дороги',
      types: ['unclassified', 'residential', 'living_street'],
      priority: 'medium'
    },
    {
      name: 'Специальные пути',
      types: ['steps', 'pedestrian'],
      priority: 'low'
    }
  ];

  // Загружаем каждую группу одним запросом
  for (const group of pathGroups) {
    try {
      statusCallback(`Загрузка: ${group.name}...`);
      
      // Адаптивные настройки в зависимости от приоритета и сети
      let timeout, maxsize;
      if (group.priority === 'high') {
        timeout = isMobile ? 25 : 30;
        maxsize = isMobile ? 2000000 : 5000000;
      } else if (group.priority === 'medium') {
        timeout = isMobile ? 35 : 45;
        maxsize = isMobile ? 3000000 : 7000000;
      } else {
        timeout = TIMEOUT;
        maxsize = 10000000;
      }
      
      // Создаем групповой запрос с regex
      const typePattern = group.types.join('|');
      const query = `[out:json][timeout:${timeout}][maxsize:${maxsize}];
        way["highway"~"^(${typePattern})$"](${bbox});
        out geom;`;

      const paths = await executeOverpassQuery(query, group.name, timeout);
      allPaths = allPaths.concat(paths);
      
      statusCallback(`✅ ${group.name}: ${paths.length} элементов`);
      
    } catch (error) {
      console.warn(`Не удалось загрузить ${group.name}:`, error.message);
      statusCallback(`⚠️ ${group.name}: ${error.message}`);
      
      // Fallback: загружаем типы из группы по отдельности
      if (group.priority === 'high') {
        statusCallback(`🔄 Fallback для ${group.name}...`);
        for (const type of group.types) {
          try {
            const fallbackTimeout = isMobile ? 20 : 25;
            const fallbackMaxsize = isMobile ? 1000000 : 2000000;
            
            const fallbackQuery = `[out:json][timeout:${fallbackTimeout}][maxsize:${fallbackMaxsize}];
              way["highway"="${type}"](${bbox});
              out geom;`;
            
            const fallbackPaths = await executeOverpassQuery(fallbackQuery, `${group.name} (${type})`, fallbackTimeout);
            allPaths = allPaths.concat(fallbackPaths);
            statusCallback(`✅ ${group.name} (${type}): ${fallbackPaths.length} элементов`);
            
          } catch (fallbackError) {
            console.warn(`Fallback не удался для ${type}:`, fallbackError.message);
            statusCallback(`❌ ${group.name} (${type}): fallback не удался`);
          }
        }
      }
    }
  }

  // Дополнительно загружаем пешеходные переходы
  try {
    statusCallback('Загрузка пешеходных переходов...');
    
    const crossingQuery = `[out:json][timeout:${TIMEOUT}][maxsize:5000000];
      way["footway"="crossing"](${bbox});
      out geom;`;

    const crossings = await executeOverpassQuery(crossingQuery, 'Пешеходные переходы', TIMEOUT);
    allPaths = allPaths.concat(crossings);
    
    statusCallback(`✅ Пешеходные переходы: ${crossings.length} элементов`);
    
  } catch (error) {
    console.warn('Не удалось загрузить пешеходные переходы:', error.message);
    statusCallback(`⚠️ Пешеходные переходы: ${error.message}`);
  }

  return allPaths;
}

// Загрузка пешеходных путей и дорог по типам
export async function fetchPaths(bounds, statusCallback) {
  // Сначала пытаемся использовать OSMnx backend
  if (await checkOSMnxAvailability()) {
    try {
      const bbox = getBboxString(bounds);
      statusCallback('🚀 Загрузка через OSMnx backend...');
      
      const paths = await fetchPathsWithOSMnx(bbox, 'пешеходные маршруты');
      
      console.log('🔍 OSMnx вернул данные:', {
        isArray: Array.isArray(paths),
        length: paths?.length,
        firstItem: paths?.[0],
        type: typeof paths
      });
      
      if (paths && paths.length > 0) {
        statusCallback(`✅ OSMnx: загружено ${paths.length} маршрутов`);
        return paths;
      } else {
        console.log('⚠️ OSMnx вернул пустой результат, переключаемся на Overpass API');
        statusCallback('⚠️ OSMnx: пустой результат, используем Overpass API');
      }
    } catch (error) {
      console.log('❌ Ошибка OSMnx backend, переключаемся на Overpass API:', error.message);
      statusCallback('⚠️ OSMnx недоступен, используем Overpass API');
    }
  }

  // Fallback на Overpass API с оптимизированной группировкой запросов
  statusCallback('🚀 Используем оптимизированную загрузку Overpass API...');
  return await fetchPathsGrouped(bounds, statusCallback);
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