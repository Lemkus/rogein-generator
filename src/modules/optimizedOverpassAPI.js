/**
 * Оптимизированный модуль для работы с Overpass API
 * Минимизирует количество запросов, объединяя все данные в один запрос
 */

import { OVERPASS_API_BASE, REQUEST_TIMEOUTS, RETRY_CONFIG } from './config.js';

const REQUEST_TIMEOUT = REQUEST_TIMEOUTS.MEDIUM; // 30 секунд

/**
 * Загружает все данные одним запросом (тропы, барьеры, закрытые зоны)
 * @param {string} bbox - bounding box в формате "south,west,north,east"
 * @param {Function} statusCallback - функция для обновления статуса
 * @returns {Promise<Object>}
 */
export async function fetchAllMapData(bbox, statusCallback) {
  const cacheKey = `all_data_${bbox}`;
  
  // Проверяем кэш
  if (window.mapDataCache && window.mapDataCache[cacheKey]) {
    statusCallback('✅ Используем кэшированные данные карты');
    return window.mapDataCache[cacheKey];
  }
  
  statusCallback('🔄 Начинаем загрузку данных карты...');
  
  try {
    // Сначала пробуем серверный API
    statusCallback('🌐 Пробуем серверный API (trailspot.app)...');
    const serverData = await fetchAllWithServerOverpass(bbox, statusCallback);
    if (serverData) {
      // Кэшируем данные
      if (!window.mapDataCache) window.mapDataCache = {};
      window.mapDataCache[cacheKey] = serverData;
      statusCallback('✅ Данные успешно загружены через серверный API');
      return serverData;
    }
  } catch (error) {
    statusCallback(`❌ Серверный API недоступен: ${error.message}`);
    console.log(`❌ Серверный API ошибка:`, error);
  }
  
  // Если серверный API недоступен, используем клиентский
  statusCallback('🔄 Переключаемся на клиентский Overpass API...');
  return await fetchAllWithClientOverpass(bbox, statusCallback);
}

/**
 * Загружает все данные через серверный API
 */
async function fetchAllWithServerOverpass(bbox, statusCallback) {
  console.log(`🚀 Загружаем ВСЕ данные одним запросом через серверный Overpass API...`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Таймаут ${REQUEST_TIMEOUT}мс превышен, прерываем запрос`);
      statusCallback(`⏰ Серверный API: таймаут ${REQUEST_TIMEOUT/1000}с превышен`);
      controller.abort();
    }, REQUEST_TIMEOUT);
    
    console.log(`📤 Отправляем запрос к серверному API...`);
    statusCallback(`📤 Серверный API: отправляем запрос (таймаут ${REQUEST_TIMEOUT/1000}с)...`);
    const startTime = Date.now();
    
    // Используем единую функцию формирования запроса
    const query = buildOverpassQuery(bbox);

    const response = await fetch(`${OVERPASS_API_BASE}/execute-query`, {
      method: 'POST',
      body: query,
      signal: controller.signal,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    
    const elapsedTime = Date.now() - startTime;
    clearTimeout(timeoutId);
    
    console.log(`📡 Получен ответ за ${elapsedTime}мс:`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    statusCallback(`📡 Серверный API: получен ответ за ${elapsedTime}мс (статус ${response.status})`);
    
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
        console.log(`📄 Тело ответа ошибки:`, errorText);
      } catch (textError) {
        console.log(`📄 Не удалось прочитать тело ответа ошибки:`, textError.message);
      }
      
      const errorMsg = `HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`;
      statusCallback(`❌ Серверный API: ошибка ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    console.log(`✅ JSON успешно распарсен`);
    console.log(`📊 Структура ответа:`, Object.keys(data));
    console.log(`📊 Полный ответ:`, data);
    statusCallback(`✅ Серверный API: JSON успешно распарсен`);
    
    // Проверяем разные возможные форматы ответа
    if (data.success && data.data) {
      console.log(`✅ Серверный Overpass вернул все данные:`);
      console.log(`   - Элементов: ${data.data.elements ? data.data.elements.length : 0}`);
      console.log(`   - Время загрузки: ${data.load_time}с`);
      
      // Используем единую функцию парсинга
      return parseOverpassData(data.data.elements, statusCallback);
    } else if (data.paths || data.barriers || data.closed_areas) {
      // Возможно, данные приходят напрямую без обертки
      console.log(`✅ Серверный Overpass вернул данные напрямую`);
      const counts = {
        paths: data.paths ? data.paths.length : 0,
        barriers: data.barriers ? data.barriers.length : 0,
        closed_areas: data.closed_areas ? data.closed_areas.length : 0,
        water_areas: data.water_areas ? data.water_areas.length : 0
      };
      
      statusCallback(`Загружено: ${counts.paths} дорог, ${counts.barriers} барьеров, ${counts.closed_areas} закрытых зон`);
      return data;
    } else if (data.success && (data.paths || data.barriers)) {
      // Серверный API возвращает данные в корне объекта
      console.log(`✅ Серверный Overpass вернул данные в корне объекта`);
      
      // Создаем объект с правильной структурой
      const result = {
        paths: data.paths || [],
        barriers: data.barriers || [],
        closed_areas: data.closed_areas || [],
        water_areas: data.water_areas || []
      };
      
      const counts = {
        paths: result.paths.length,
        barriers: result.barriers.length,
        closed_areas: result.closed_areas.length,
        water_areas: result.water_areas.length
      };
      
      console.log(`   - Дороги/тропы: ${counts.paths}`);
      console.log(`   - Барьеры: ${counts.barriers}`);
      console.log(`   - Закрытые зоны: ${counts.closed_areas}`);
      console.log(`   - Водоёмы: ${counts.water_areas}`);
      console.log(`   - Время загрузки: ${data.load_time}с`);
      
      statusCallback(`✅ Серверный API: загружено ${counts.paths} дорог, ${counts.barriers} барьеров, ${counts.closed_areas} закрытых зон`);
      return result;
    } else {
      console.log(`❌ Неожиданная структура данных:`, data);
      throw new Error(data.error || 'Неизвестная ошибка серверного Overpass API');
    }
    
  } catch (error) {
    console.log(`❌ === ОШИБКА ЗАПРОСА К СЕРВЕРНОМУ OVERPASS ===`);
    console.log(`❌ Тип ошибки:`, error.name);
    console.log(`❌ Сообщение:`, error.message);
    
    if (error.name === 'AbortError') {
      statusCallback(`❌ Серверный API: запрос прерван по таймауту`);
    } else if (error.message.includes('Failed to fetch')) {
      statusCallback(`❌ Серверный API: ошибка сети (сервер недоступен)`);
    } else {
      statusCallback(`❌ Серверный API: ${error.message}`);
    }
    
    throw error;
  }
}

/**
 * Задержка между попытками
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Единая функция формирования Overpass запроса
 * Используется как для серверного, так и для клиентского API
 */
function buildOverpassQuery(bbox) {
  const [south, west, north, east] = bbox.split(',').map(Number);
  
  return `[out:json][timeout:30];
(
  way["highway"~"^(path|footway|cycleway|track|service|bridleway|unclassified|residential|living_street|steps|pedestrian)$"](${south},${west},${north},${east});
  way["barrier"="wall"](${south},${west},${north},${east});
  way["barrier"="gate"](${south},${west},${north},${east});
  way["barrier"="fence"](${south},${west},${north},${east});
  way["landuse"="military"](${south},${west},${north},${east});
  relation["landuse"="military"](${south},${west},${north},${east});
  way["military"](${south},${west},${north},${east});
  relation["military"](${south},${west},${north},${east});
  way["access"="private"](${south},${west},${north},${east});
  relation["access"="private"](${south},${west},${north},${east});
  way["access"="no"](${south},${west},${north},${east});
  relation["access"="no"](${south},${west},${north},${east});
  way["access"="restricted"](${south},${west},${north},${east});
  relation["access"="restricted"](${south},${west},${north},${east});
);
out geom;`;
}

/**
 * Единая функция парсинга данных Overpass API
 * Используется как для серверного, так и для клиентского API
 */
function parseOverpassData(elements, statusCallback) {
  const result = {
    paths: [],
    barriers: [],
    closed_areas: [],
    water_areas: []
  };

  let pathCount = 0;
  let barrierCount = 0;
  let closedAreaCount = 0;

  for (const element of elements || []) {
    if ((element.type === 'way' || element.type === 'relation') && element.geometry) {
      const geometry = element.geometry.map(coord => [coord.lat, coord.lon]);
      
      if (geometry.length >= 2) {
        const tags = element.tags || {};
        const highway = tags.highway || '';
        const barrier = tags.barrier || '';
        const natural = tags.natural || '';
        const military = tags.military || '';
        const landuse = tags.landuse || '';
        const access = tags.access || '';
        
        // Проверяем категории по приоритету
        
        // 1. Закрытые зоны (высший приоритет)
        if (military || landuse === 'military' || access === 'no' || access === 'private' || access === 'restricted') {
          result.closed_areas.push({
            geometry: geometry,
            type: 'closed_area',
            military: military,
            landuse: landuse,
            access: access,
            name: tags.name || '',
            osmid: String(element.id)
          });
          closedAreaCount++;
        }
        // 2. Дороги/тропы
        else if (highway && ['path', 'footway', 'cycleway', 'track', 'service', 'bridleway', 'unclassified', 'residential', 'living_street', 'steps', 'pedestrian'].includes(highway)) {
          result.paths.push({
            geometry: geometry,
            highway: highway,
            name: tags.name || '',
            surface: tags.surface || '',
            access: access,
            osmid: String(element.id),
            length: 0
          });
          pathCount++;
        }
        // 3. Искусственные барьеры
        else if (barrier && ['wall', 'gate', 'fence'].includes(barrier)) {
          result.barriers.push({
            geometry: geometry,
            type: 'barrier',
            barrier_type: barrier,
            access: access,
            osmid: String(element.id)
          });
          barrierCount++;
        }
      }
    }
  }

  statusCallback(`Загружено: ${pathCount} дорог, ${barrierCount} барьеров, ${closedAreaCount} закрытых зон`);
  return result;
}

/**
 * Загружает все данные через клиентский Overpass API с retry логикой
 */
async function fetchAllWithClientOverpass(bbox, statusCallback) {
  const [south, west, north, east] = bbox.split(',').map(Number);
  statusCallback(`🌐 Клиентский API: подключаемся к overpass-api.de...`);
  
  // Проверяем корректность bbox
  if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
    throw new Error(`Некорректные координаты области`);
  }
  
  if (south >= north || west >= east) {
    throw new Error(`Некорректные координаты области`);
  }
  
  // Проверяем размер области - если слишком большая, уменьшаем запрос
  const latDiff = north - south;
  const lonDiff = east - west;
  const areaSize = latDiff * lonDiff;
  
  if (areaSize > 0.01) { // Если область больше ~1 км²
    statusCallback('⚠️ Область слишком большая, попробуйте выбрать меньшую область');
    throw new Error('Область слишком большая для загрузки данных');
  }
  
  // Используем единую функцию формирования запроса
  const query = buildOverpassQuery(bbox);

  let lastError;
  
  // Retry логика
  for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
    try {
      statusCallback(`🔄 Клиентский API: попытка ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS} (таймаут ${REQUEST_TIMEOUT/1000}с)...`);
      
      // Используем Promise.race для таймаута без AbortController
      // Это позволяет избежать проблем с signal, который может влиять на чтение body
      const fetchPromise = fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' }
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Fetch timeout')), REQUEST_TIMEOUT)
      );
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      statusCallback(`📡 Клиентский API: получен ответ (статус ${response.status})`);
      
      if (!response.ok) {
        if (response.status === 504 || response.status === 429) {
          // Gateway timeout или rate limit - пробуем еще раз
          statusCallback(`⚠️ Клиентский API: сервер перегружен (${response.status}), попытка ${attempt}`);
          throw new Error(`Сервер перегружен (${response.status}), попытка ${attempt}`);
        } else {
          statusCallback(`❌ Клиентский API: ошибка загрузки (${response.status})`);
          throw new Error(`Ошибка загрузки данных (${response.status})`);
        }
      }
      
      // Читаем JSON (браузер сам обрабатывает chunked encoding)
      // В старой рабочей версии использовался просто response.json() без таймаута
      const data = await response.json();
      statusCallback(`✅ Клиентский API: JSON прочитан (${data.elements ? data.elements.length : 0} элементов)`);
      
      // Используем единую функцию парсинга
      const result = parseOverpassData(data.elements, statusCallback);
      
      // Кэшируем данные
      if (!window.mapDataCache) window.mapDataCache = {};
      window.mapDataCache[`all_data_${bbox}`] = result;
      
      return result;
      
    } catch (error) {
      lastError = error;
      console.log(`❌ Попытка ${attempt} неудачна:`, error.message);
      
      // Обработка таймаута
      if (error.message === 'Fetch timeout') {
        statusCallback(`⏰ Клиентский API: таймаут ${REQUEST_TIMEOUT/1000}с на попытке ${attempt}`);
      }
      
      // Если это последняя попытка, выбрасываем ошибку
      if (attempt === RETRY_CONFIG.MAX_ATTEMPTS) {
        statusCallback(`❌ Клиентский API: не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток`);
        throw new Error(`Не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток. Последняя ошибка: ${error.message}`);
      }
      
      // Ждем перед следующей попыткой
      const delayTime = RETRY_CONFIG.DELAY_BETWEEN_ATTEMPTS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
      statusCallback(`⏳ Клиентский API: повторная попытка через ${Math.round(delayTime/1000)}с...`);
      await delay(delayTime);
    }
  }
}

/**
 * Очищает кэш данных карты
 */
export function clearMapDataCache() {
  if (window.mapDataCache) {
    window.mapDataCache = {};
  }
}
