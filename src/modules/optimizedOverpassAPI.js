/**
 * Единый модуль для работы с Overpass API
 * Поддерживает как серверный, так и клиентский API с единой обработкой
 */

import { OVERPASS_API_BASE, REQUEST_TIMEOUTS, RETRY_CONFIG } from './config.js';

const REQUEST_TIMEOUT = REQUEST_TIMEOUTS.MEDIUM; // 30 секунд

/**
 * Проверяет корректность bbox и возвращает распарсенные координаты
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @returns {Object} объект с координатами {south, west, north, east}
 * @throws {Error} если bbox некорректен
 */
function validateBbox(bbox) {
  const [south, west, north, east] = bbox.split(',').map(Number);
  
  if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
    throw new Error('Некорректные координаты области');
  }
  
  if (south >= north || west >= east) {
    throw new Error('Некорректные координаты области');
  }
  
  const latDiff = north - south;
  const lonDiff = east - west;
  const areaSize = latDiff * lonDiff;
  
  if (areaSize > 0.01) {
    throw new Error('Область слишком большая для загрузки данных');
  }
  
  return { south, west, north, east };
}

/**
 * Создает AbortController с таймаутом
 * @param {number} timeout - таймаут в мс
 * @param {Function} statusCallback - функция для обновления статуса
 * @param {string} apiType - тип API для сообщений
 * @returns {Object} объект с controller и timeoutId
 */
function createAbortController(timeout, statusCallback, apiType) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
    if (statusCallback) statusCallback(`⏰ ${apiType}: таймаут ${timeout/1000}с превышен`);
      controller.abort();
  }, timeout);
  return { controller, timeoutId };
}

/**
 * Единая функция для чтения и парсинга JSON ответа
 * Используется как для серверного, так и для клиентского API
 * ВАЖНО: Всегда читаем как текст, чтобы избежать зависания на больших ответах
 * @param {Response} response - объект Response от fetch
 * @param {Function} statusCallback - функция для обновления статуса (опционально)
 * @param {boolean} forceTextMode - принудительно читать как текст (для клиентского API)
 * @returns {Promise<Object>} распарсенные JSON данные
 */
async function parseJsonResponse(response, statusCallback = null, forceTextMode = false) {
  // Для клиентского API всегда читаем как текст, чтобы избежать зависания
  // response.json() может зависать на очень больших ответах
  if (forceTextMode) {
    if (statusCallback) statusCallback(`📄 Читаем ответ как текст (режим для больших ответов)...`);
    const text = await response.text();
    
    if (text.includes('<?xml') || text.includes('<html')) {
      const errorMsg = 'Сервер вернул XML/HTML вместо JSON';
      if (statusCallback) statusCallback(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    try {
      if (statusCallback) statusCallback(`🔄 Парсим JSON (размер: ${(text.length / 1024).toFixed(1)} KB)...`);
      return JSON.parse(text);
    } catch (parseError) {
      if (statusCallback) statusCallback(`❌ Ошибка парсинга JSON: ${parseError.message}`);
      throw new Error(`Ошибка парсинга ответа: ${parseError.message}`);
    }
  }
  
  // Для серверного API пробуем сначала JSON (обычно меньше по размеру)
  const contentType = response.headers.get('content-type') || '';
  
  if (contentType.includes('json') || contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      // Если не получилось, читаем как текст
      const text = await response.text();
      return JSON.parse(text);
    }
  }
  
  // Если Content-Type не JSON, читаем как текст и парсим
  const text = await response.text();
  
  // Проверяем, что это не XML/HTML
  if (text.includes('<?xml') || text.includes('<html')) {
    const errorMsg = 'Сервер вернул XML/HTML вместо JSON';
    if (statusCallback) statusCallback(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  try {
    return JSON.parse(text);
  } catch (parseError) {
    if (statusCallback) statusCallback(`❌ Ошибка парсинга JSON: ${parseError.message}`);
    throw new Error(`Ошибка парсинга ответа: ${parseError.message}`);
  }
}

/**
 * Формирует Overpass запрос для получения всех данных
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @returns {string} Overpass query
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
  let skippedCount = 0;

  for (const element of elements || []) {
    // Проверяем наличие geometry (для запросов с out geom)
    let geometry = null;
    
    if (element.geometry && Array.isArray(element.geometry)) {
      // Формат с geometry (out geom)
      geometry = element.geometry.map(coord => [coord.lat, coord.lon]);
    } else if (element.nodes && Array.isArray(element.nodes)) {
      // Формат с nodes - пропускаем (нужны node элементы)
      skippedCount++;
      continue;
    } else if (element.type === 'way' && element.lat !== undefined && element.lon !== undefined) {
      // Одиночная точка
      geometry = [[element.lat, element.lon]];
    } else {
      skippedCount++;
      continue;
    }
    
    if ((element.type === 'way' || element.type === 'relation') && geometry && geometry.length >= 2) {
        const tags = element.tags || {};
        const highway = tags.highway || '';
        const barrier = tags.barrier || '';
        const military = tags.military || '';
        const landuse = tags.landuse || '';
        const access = tags.access || '';
        
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

  statusCallback(`Загружено: ${pathCount} дорог, ${barrierCount} барьеров, ${closedAreaCount} закрытых зон`);
  return result;
}

/**
 * Единая функция выполнения запроса к Overpass API
 * Обрабатывает ответ единообразно для серверного и клиентского API
 * @param {Response} response - объект Response от fetch
 * @param {Function} statusCallback - функция для обновления статуса
 * @param {string} apiType - тип API ('server' или 'client') для логирования
 * @returns {Promise<Object>} объект с elements для дальнейшей обработки
 */
async function processOverpassResponse(response, statusCallback, apiType = 'API') {
  if (!response.ok) {
    let errorText = '';
    let errorData = null;
    
    try {
      errorText = await response.text();
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        // Не JSON
      }
    } catch (textError) {
      // Не удалось прочитать
    }
    
    // Извлекаем информацию об ошибке
    let errorMsg = '';
    if (errorData && errorData.error) {
      errorMsg = errorData.error;
      if (errorMsg.includes('Overpass API error: 504')) {
        errorMsg = 'Overpass API перегружен (504 Gateway Timeout)';
      } else if (errorMsg.includes('Overpass API error: 429')) {
        errorMsg = 'Overpass API: превышен лимит запросов (429)';
      }
    } else if (errorText.includes('<?xml') || errorText.includes('<html')) {
      const errorMatch = errorText.match(/<strong[^>]*>Error<\/strong>.*?<p[^>]*>([^<]+)<\/p>/is);
      errorMsg = errorMatch ? errorMatch[1].trim() : 'Сервер Overpass API перегружен или недоступен';
    } else {
      errorMsg = errorText || `${response.status} ${response.statusText}`;
    }
    
    const fullErrorMsg = `HTTP ${response.status}: ${errorMsg}`;
    if (statusCallback) statusCallback(`❌ ${apiType}: ошибка ${fullErrorMsg}`);
    throw new Error(fullErrorMsg);
  }
  
  // Используем единую функцию парсинга
  // Для клиентского API используем forceTextMode=true, чтобы избежать зависания на больших ответах
  const isClientAPI = apiType === 'Клиентский API' || apiType === 'client';
  const data = await parseJsonResponse(response, statusCallback, isClientAPI);
  
  // Обрабатываем разные форматы ответа
  if (data.success && data.data && data.data.elements) {
    // Формат серверного API: {success: true, data: {elements: [...]}}
    if (statusCallback) statusCallback(`✅ ${apiType}: получено ${data.data.elements.length} элементов`);
    return data.data; // Возвращаем объект с elements
  } else if (data.elements) {
    // Формат клиентского API: {elements: [...]}
    if (statusCallback) statusCallback(`✅ ${apiType}: получено ${data.elements.length} элементов`);
    return data; // Возвращаем объект с elements
  } else if (data.error) {
    const errorMsg = data.error;
    if (statusCallback) statusCallback(`❌ ${apiType}: ${errorMsg}`);
    throw new Error(errorMsg);
  } else {
    const errorMsg = 'Неизвестная ошибка Overpass API';
    if (statusCallback) statusCallback(`❌ ${apiType}: ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

/**
 * Загружает все данные через серверный Overpass API
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @param {Function} statusCallback - функция для обновления статуса (опционально)
 * @returns {Promise<Object>} объект с данными {elements: [...]}
 */
async function fetchAllWithServerOverpass(bbox, statusCallback = null) {
  // Проверяем корректность bbox
  validateBbox(bbox);
  
  if (statusCallback) statusCallback('🌐 Серверный API: формируем запрос...');
  
  try {
    const { controller, timeoutId } = createAbortController(REQUEST_TIMEOUT, statusCallback, 'Серверный API');
    
    const query = buildOverpassQuery(bbox);
    if (statusCallback) statusCallback(`📤 Серверный API: отправляем запрос (таймаут ${REQUEST_TIMEOUT/1000}с)...`);
    
    const startTime = Date.now();
    const response = await fetch(`${OVERPASS_API_BASE}/execute-query`, {
      method: 'POST',
      body: query,
      signal: controller.signal,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    
    clearTimeout(timeoutId);
    const elapsedTime = Date.now() - startTime;
    if (statusCallback) statusCallback(`📡 Серверный API: получен ответ за ${elapsedTime}мс (статус ${response.status})`);
    
    // Используем единую функцию обработки ответа
    return await processOverpassResponse(response, statusCallback, 'Серверный API');
    
  } catch (error) {
    if (error.name === 'AbortError') {
      if (statusCallback) statusCallback(`❌ Серверный API: запрос прерван по таймауту`);
    } else if (error.message.includes('Failed to fetch')) {
      if (statusCallback) statusCallback(`❌ Серверный API: ошибка сети (сервер недоступен)`);
    } else {
      if (statusCallback) statusCallback(`❌ Серверный API: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Кэширует данные карты
 * @param {string} cacheKey - ключ кэша
 * @param {Object} data - данные для кэширования
 */
function cacheMapData(cacheKey, data) {
  if (!window.mapDataCache) window.mapDataCache = {};
  window.mapDataCache[cacheKey] = data;
}

/**
 * Загружает все данные через клиентский Overpass API с retry логикой
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @param {Function} statusCallback - функция для обновления статуса
 * @returns {Promise<Object>} объект с данными {paths, barriers, closed_areas, water_areas}
 */
async function fetchAllWithClientOverpass(bbox, statusCallback) {
  // Проверяем корректность bbox
  validateBbox(bbox);
  
  statusCallback(`🌐 Клиентский API: подключаемся к overpass-api.de...`);
  const query = buildOverpassQuery(bbox);
  let lastError;
  
  for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
    try {
      statusCallback(`🔄 Клиентский API: попытка ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS} (таймаут ${REQUEST_TIMEOUT/1000}с)...`);
      
      const { controller, timeoutId } = createAbortController(REQUEST_TIMEOUT, statusCallback, `Клиентский API (попытка ${attempt})`);
      
      const startTime = Date.now();
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        signal: controller.signal,
        headers: { 'Content-Type': 'text/plain' }
      });
      
      clearTimeout(timeoutId);
      const elapsedTime = Date.now() - startTime;
      statusCallback(`📡 Клиентский API: получен ответ за ${elapsedTime}мс (статус ${response.status})`);
      
      // Используем единую функцию обработки ответа
      const data = await processOverpassResponse(response, statusCallback, 'Клиентский API');
      
      if (!data || !data.elements) {
        statusCallback(`❌ Клиентский API: некорректный формат данных`);
        throw new Error('Некорректный формат данных от клиентского API');
      }
      
      // Используем единую функцию парсинга данных
      const result = parseOverpassData(data.elements, statusCallback);
      
      // Кэшируем данные
      cacheMapData(`all_data_${bbox}`, result);
      
      return result;
      
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === RETRY_CONFIG.MAX_ATTEMPTS;
      
      if (error.name === 'AbortError') {
        statusCallback(`⏰ Клиентский API: запрос прерван по таймауту на попытке ${attempt}`);
        if (isLastAttempt) {
          statusCallback(`❌ Клиентский API: не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток (таймауты)`);
          throw new Error(`Не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток. Все запросы превысили таймаут ${REQUEST_TIMEOUT/1000}с`);
        }
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        statusCallback(`🌐 Клиентский API: ошибка сети на попытке ${attempt}`);
        if (isLastAttempt) {
          statusCallback(`❌ Клиентский API: не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток (ошибка сети)`);
          throw new Error(`Не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток. Ошибка сети: ${error.message}`);
        }
      } else if (error.message.includes('Сервер перегружен') || error.message.includes('504')) {
        statusCallback(`⚠️ Клиентский API: сервер перегружен (504) на попытке ${attempt}`);
        if (isLastAttempt) {
          statusCallback(`❌ Клиентский API: сервер Overpass API перегружен. Попробуйте уменьшить область запроса или повторить позже.`);
          throw new Error(`Сервер Overpass API перегружен (504). Попробуйте уменьшить область запроса или повторить позже.`);
        }
        const delayTime = RETRY_CONFIG.DELAY_BETWEEN_ATTEMPTS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1) * 2;
        statusCallback(`⏳ Клиентский API: сервер перегружен, ждем ${Math.round(delayTime/1000)}с перед следующей попыткой...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
        continue;
      } else {
        if (isLastAttempt) {
        statusCallback(`❌ Клиентский API: не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток`);
        throw new Error(`Не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток. Последняя ошибка: ${error.message}`);
        }
      }
      
      if (!isLastAttempt) {
      const delayTime = RETRY_CONFIG.DELAY_BETWEEN_ATTEMPTS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
      statusCallback(`⏳ Клиентский API: повторная попытка через ${Math.round(delayTime/1000)}с...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }
    }
  }
  
  if (lastError) {
    throw lastError;
  } else {
    throw new Error('Не удалось загрузить данные: неизвестная ошибка');
  }
}

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
  
  // Сначала пробуем серверный API
  try {
    statusCallback('🌐 Пробуем серверный API (trailspot.app)...');
    const serverResponse = await fetchAllWithServerOverpass(bbox, statusCallback);
    
    if (serverResponse && serverResponse.elements) {
      const parsedData = parseOverpassData(serverResponse.elements, statusCallback);
      
      cacheMapData(cacheKey, parsedData);
      statusCallback('✅ Данные успешно загружены через серверный API');
      return parsedData;
    } else {
      throw new Error('Серверный API вернул некорректные данные');
    }
  } catch (error) {
    statusCallback(`❌ Серверный API недоступен: ${error.message}`);
  }
  
  // Используем клиентский API
  statusCallback('🔄 Переключаемся на клиентский Overpass API...');
  
  try {
    const clientData = await fetchAllWithClientOverpass(bbox, statusCallback);
    return clientData;
  } catch (clientError) {
    statusCallback(`❌ Не удалось загрузить данные: ${clientError.message}`);
    statusCallback(`💡 Попробуйте: уменьшить область запроса или повторить попытку позже`);
    throw clientError;
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
