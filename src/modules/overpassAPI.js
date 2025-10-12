/**
 * Модуль для работы с Overpass API
 * Загружает данные из OpenStreetMap с приоритетом: Server Overpass -> Client Overpass
 */

import {
  isServerOverpassAvailable,
  fetchPathsWithServerOverpass,
  fetchBarriersWithServerOverpass,
  fetchAllWithServerOverpass,
  fetchClosedAreasWithServerOverpass,
  fetchWaterAreasWithServerOverpass
} from './serverOverpassAPI.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TIMEOUT = 60; // Увеличиваем таймаут для мобильных сетей

// Простой кэш для избежания повторных запросов
const queryCache = new Map();

// Флаг доступности серверного Overpass API (кэшируется на время сессии)
let serverOverpassAvailable = null;

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
 * Проверяет доступность серверного Overpass API с кэшированием
 * @returns {Promise<boolean>}
 */
async function checkServerOverpassAvailability() {
  if (serverOverpassAvailable === null) {
    console.log('🔍 Проверяем доступность серверного Overpass API...');
    serverOverpassAvailable = await isServerOverpassAvailable();
    
    if (serverOverpassAvailable) {
      console.log('✅ Серверный Overpass API доступен - будет использован для загрузки данных');
    } else {
      console.log('⚠️ Серверный Overpass API недоступен - используется клиентский Overpass API');
    }
  }
  
  return serverOverpassAvailable;
}

/**
 * Конвертирует bounds в строку bbox
 * @param {Object} bounds - объект bounds с методами getSouth(), getWest(), getNorth(), getEast()
 * @returns {string} строка bbox в формате 'south,west,north,east'
 */
function getBboxString(bounds) {
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();
  
  return `${south},${west},${north},${east}`;
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
  // Приоритет 1: Серверный Overpass API
  if (await checkServerOverpassAvailability()) {
    try {
      const bbox = getBboxString(bounds);
      console.log('🚀 Загрузка закрытых зон через серверный Overpass API...');
      
      const closedAreas = await fetchClosedAreasWithServerOverpass(bbox);
      
      if (closedAreas.length > 0) {
        console.log(`✅ Серверный Overpass: загружено ${closedAreas.length} закрытых зон`);
        return closedAreas;
      } else {
        console.log('⚠️ Серверный Overpass вернул пустой результат для закрытых зон, используем клиентский Overpass API');
      }
    } catch (error) {
      console.log('❌ Ошибка серверного Overpass API для закрытых зон, используем клиентский Overpass API:', error.message);
    }
  }

  // Приоритет 2: Клиентский Overpass API
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

// Загрузка водоёмов - ОТКЛЮЧЕНА (не нужны для навигации по тропам)
export async function fetchWaterAreas(bounds) {
  console.log('💧 Водоёмы не загружаются - не нужны для навигации по тропам');
  return [];
}

// Загрузка барьеров - только ЯВНО ЗАПРЕЩЁННЫЕ
export async function fetchBarriers(bounds) {
  // Используем только серверный Overpass API
  if (await checkServerOverpassAvailability()) {
    try {
      const bbox = getBboxString(bounds);
      console.log('🚀 Загрузка барьеров через серверный Overpass API...');
      
      const barriers = await fetchBarriersWithServerOverpass(bbox);
      
      // Возвращаем результат независимо от того, пустой он или нет
      console.log(`✅ Серверный Overpass: загружено ${barriers.length} барьеров`);
      return barriers;
    } catch (error) {
      console.log('❌ Ошибка серверного Overpass API для барьеров:', error.message);
      // Возвращаем пустой массив вместо переключения на клиентский API
      return [];
    }
  }

  // Если серверный API недоступен, возвращаем пустой массив
  console.log('⚠️ Серверный Overpass API недоступен, барьеры не загружены');
  return [];
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
  // Приоритет 1: Серверный Overpass API
  if (await checkServerOverpassAvailability()) {
    try {
      const bbox = getBboxString(bounds);
      statusCallback('🚀 Загрузка через серверный Overpass API...');
      
      const paths = await fetchPathsWithServerOverpass(bbox, 'пешеходные маршруты');
      
      console.log('🔍 Серверный Overpass вернул данные:', {
        isArray: Array.isArray(paths),
        length: paths?.length,
        firstItem: paths?.[0],
        type: typeof paths
      });
      
      if (paths && paths.length > 0) {
        statusCallback(`✅ Серверный Overpass: загружено ${paths.length} маршрутов`);
        return paths;
      } else {
        console.log('⚠️ Серверный Overpass вернул пустой результат, используем клиентский Overpass API');
        statusCallback('⚠️ Серверный Overpass: пустой результат, используем клиентский Overpass API');
      }
    } catch (error) {
      console.log('❌ Ошибка серверного Overpass API, используем клиентский Overpass API:', error.message);
      statusCallback('⚠️ Серверный Overpass недоступен, используем клиентский Overpass API');
    }
  }

  // Приоритет 2: Клиентский Overpass API с оптимизированной группировкой запросов
  statusCallback('🚀 Используем клиентский Overpass API...');
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