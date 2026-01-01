/**
 * Модуль для работы с серверным Overpass API
 * Использует backend_simple.py вместо прямых запросов к overpass-api.de
 */

import { OVERPASS_API_BASE, REQUEST_TIMEOUTS } from './config.js';

const REQUEST_TIMEOUT = REQUEST_TIMEOUTS.MEDIUM; // 30 секунд

/**
 * Выполняет запрос к серверному Overpass API
 * @param {string} endpoint - endpoint API
 * @param {string} description - описание запроса для логирования
 * @param {number} timeout - таймаут запроса в мс
 * @returns {Promise<Object>}
 */
async function executeServerOverpassRequest(endpoint, description, timeout = REQUEST_TIMEOUT) {
  console.log(`🚀 === НАЧАЛО ЗАПРОСА К СЕРВЕРНОМУ OVERPASS ===`);
  console.log(`🔗 URL: ${OVERPASS_API_BASE}${endpoint}`);
  console.log(`📝 Описание: ${description}`);
  console.log(`⏱️ Таймаут: ${timeout}мс`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Таймаут ${timeout}мс превышен, прерываем запрос`);
      controller.abort();
    }, timeout);
    
    console.log(`📤 Отправляем запрос...`);
    const startTime = Date.now();
    
    const response = await fetch(`${OVERPASS_API_BASE}${endpoint}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const elapsedTime = Date.now() - startTime;
    clearTimeout(timeoutId);
    
    console.log(`📡 Получен ответ за ${elapsedTime}мс:`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
        console.log(`📄 Тело ответа ошибки (${errorText.length} символов):`, errorText);
      } catch (textError) {
        console.log(`📄 Не удалось прочитать тело ответа ошибки:`, textError.message);
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }
    
    // Читаем и парсим ответ
    const responseText = await response.text();
    console.log(`📄 Получен ответ длиной ${responseText.length} символов`);
    console.log(`📄 Первые 500 символов ответа:`, responseText.substring(0, 500));
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`✅ JSON успешно распарсен, тип данных:`, typeof data);
      if (data && typeof data === 'object') {
        console.log(`📊 Ключи в ответе:`, Object.keys(data));
        if (data.success !== undefined) {
          console.log(`🎯 success:`, data.success);
        }
        if (data.count !== undefined) {
          console.log(`📊 count:`, data.count);
        }
        if (data.error !== undefined) {
          console.log(`❌ error:`, data.error);
        }
      }
    } catch (parseError) {
      console.error(`❌ Ошибка парсинга JSON:`, parseError);
      console.log(`📄 Сырой ответ:`, responseText);
      throw new Error(`Не удалось распарсить JSON: ${parseError.message}`);
    }
    
    console.log(`✅ === ЗАПРОС К СЕРВЕРНОМУ OVERPASS УСПЕШЕН ===`);
    return data;
    
  } catch (error) {
    console.log(`❌ === ОШИБКА ЗАПРОСА К СЕРВЕРНОМУ OVERPASS ===`);
    console.log(`❌ Тип ошибки:`, error.name);
    console.log(`❌ Сообщение:`, error.message);
    console.log(`❌ Стек:`, error.stack);
    throw error;
  }
}

/**
 * Проверяет доступность серверного Overpass API
 * @returns {Promise<boolean>}
 */
export async function isServerOverpassAvailable() {
  try {
    console.log(`🔍 Проверяем доступность серверного Overpass API...`);
    const response = await fetch(`${OVERPASS_API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 секунд на проверку
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Серверный Overpass API доступен:`, data);
      return data.status === 'healthy';
    } else {
      console.log(`❌ Серверный Overpass API недоступен: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Ошибка проверки серверного Overpass API:`, error.message);
    return false;
  }
}

/**
 * Получает пешеходные маршруты через серверный Overpass API
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @param {string} pathType - тип путей для логирования
 * @returns {Promise<Array>}
 */
export async function fetchPathsWithServerOverpass(bbox, pathType = 'пешеходные маршруты') {
  console.log(`🛤️ Загружаем ${pathType} через серверный Overpass API...`);
  
  const endpoint = `/paths?bbox=${bbox}`;
  const data = await executeServerOverpassRequest(endpoint, `Серверный Overpass ${pathType}`);
  
  if (data.success && data.data) {
    console.log(`✅ Серверный Overpass вернул ${data.count} ${pathType}`);
    return data.data;
  } else {
    throw new Error(data.error || 'Неизвестная ошибка серверного Overpass API');
  }
}

/**
 * Получает барьеры через серверный Overpass API
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @param {string} barrierType - тип барьеров для логирования
 * @returns {Promise<Array>}
 */
export async function fetchBarriersWithServerOverpass(bbox, barrierType = 'барьеры') {
  console.log(`🚧 Загружаем ${barrierType} через серверный Overpass API...`);
  
  const endpoint = `/barriers?bbox=${bbox}`;
  const data = await executeServerOverpassRequest(endpoint, `Серверный Overpass ${barrierType}`);
  
  if (data.success && data.data) {
    console.log(`✅ Серверный Overpass вернул ${data.count} ${barrierType}`);
    return data.data;
  } else {
    throw new Error(data.error || 'Неизвестная ошибка серверного Overpass API');
  }
}


/**
 * Получает закрытые зоны через серверный Overpass API
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @param {string} areaType - тип зон для логирования
 * @returns {Promise<Array>}
 */
export async function fetchClosedAreasWithServerOverpass(bbox, areaType = 'закрытые зоны') {
  console.log(`🚧 Загружаем ${areaType} через серверный Overpass API...`);
  
  const endpoint = `/closed-areas?bbox=${bbox}`;
  const data = await executeServerOverpassRequest(endpoint, `Серверный Overpass ${areaType}`);
  
  if (data.success && data.data) {
    console.log(`✅ Серверный Overpass вернул ${data.count} ${areaType}`);
    return data.data;
  } else {
    throw new Error(data.error || 'Неизвестная ошибка серверного Overpass API');
  }
}

/**
 * Получает водоёмы через серверный Overpass API
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @param {string} waterType - тип водоёмов для логирования
 * @returns {Promise<Array>}
 */
export async function fetchWaterAreasWithServerOverpass(bbox, waterType = 'водоёмы') {
  console.log(`💧 Загружаем ${waterType} через серверный Overpass API...`);
  
  const endpoint = `/water-areas?bbox=${bbox}`;
  const data = await executeServerOverpassRequest(endpoint, `Серверный Overpass ${waterType}`);
  
  if (data.success && data.data) {
    console.log(`✅ Серверный Overpass вернул ${data.count} ${waterType}`);
    return data.data;
  } else {
    throw new Error(data.error || 'Неизвестная ошибка серверного Overpass API');
  }
}

/**
 * Формирует Overpass запрос для получения всех данных
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @returns {string} Overpass query
 */
export function buildOverpassQuery(bbox) {
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
 * Получает все данные одним запросом через серверный Overpass API
 * Использует endpoint /execute-query для проксирования запроса к Overpass API
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @param {Function} statusCallback - функция для обновления статуса (опционально)
 * @returns {Promise<Object>} объект с данными {paths, barriers, closed_areas, water_areas}
 */
export async function fetchAllWithServerOverpass(bbox, statusCallback = null) {
  console.log(`🚀 Загружаем ВСЕ данные одним запросом через серверный Overpass API...`);
  if (statusCallback) statusCallback('🌐 Серверный API: формируем запрос...');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Таймаут ${REQUEST_TIMEOUT}мс превышен, прерываем запрос`);
      if (statusCallback) statusCallback(`⏰ Серверный API: таймаут ${REQUEST_TIMEOUT/1000}с превышен`);
      controller.abort();
    }, REQUEST_TIMEOUT);
    
    // Формируем Overpass запрос
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
    
    const elapsedTime = Date.now() - startTime;
    clearTimeout(timeoutId);
    
    console.log(`📡 Получен ответ за ${elapsedTime}мс:`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (statusCallback) statusCallback(`📡 Серверный API: получен ответ за ${elapsedTime}мс (статус ${response.status})`);
    
    if (!response.ok) {
      let errorText = '';
      let errorData = null;
      
      try {
        errorText = await response.text();
        console.log(`📄 Тело ответа ошибки:`, errorText);
        
        // Пытаемся распарсить как JSON, если это JSON ответ
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          // Не JSON, оставляем как текст
        }
      } catch (textError) {
        console.log(`📄 Не удалось прочитать тело ответа ошибки:`, textError.message);
      }
      
      // Извлекаем информацию об ошибке
      let errorMsg = '';
      if (errorData && errorData.error) {
        // Если сервер вернул JSON с полем error, используем его
        errorMsg = errorData.error;
        // Если это ошибка от Overpass API (например, "Overpass API error: 504"), 
        // это означает, что Overpass API перегружен
        if (errorMsg.includes('Overpass API error: 504')) {
          errorMsg = 'Overpass API перегружен (504 Gateway Timeout)';
        } else if (errorMsg.includes('Overpass API error: 429')) {
          errorMsg = 'Overpass API: превышен лимит запросов (429)';
        }
      } else {
        errorMsg = errorText || `${response.status} ${response.statusText}`;
      }
      
      const fullErrorMsg = `HTTP ${response.status}: ${errorMsg}`;
      if (statusCallback) statusCallback(`❌ Серверный API: ошибка ${fullErrorMsg}`);
      throw new Error(fullErrorMsg);
    }
    
    // Проверяем Content-Type перед парсингом
    const contentType = response.headers.get('content-type') || '';
    let data;
    
    try {
      if (contentType.includes('json') || contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // Пытаемся прочитать как текст и распарсить
        const textData = await response.text();
        data = JSON.parse(textData);
      }
      console.log(`✅ JSON успешно распарсен`);
    } catch (parseError) {
      console.error(`❌ Ошибка парсинга JSON:`, parseError);
      if (statusCallback) statusCallback(`❌ Серверный API: ошибка парсинга JSON`);
      throw new Error(`Не удалось распарсить ответ сервера: ${parseError.message}`);
    }
    
    if (data.success && data.data && data.data.elements) {
      console.log(`✅ Серверный Overpass вернул ${data.data.elements.length} элементов`);
      console.log(`   - Время загрузки: ${data.load_time}с`);
      if (statusCallback) statusCallback(`✅ Серверный API: получено ${data.data.elements.length} элементов`);
      return data.data; // Возвращаем объект с elements для дальнейшей обработки
    } else if (data.error) {
      const errorMsg = data.error;
      if (statusCallback) statusCallback(`❌ Серверный API: ${errorMsg}`);
      throw new Error(errorMsg);
    } else {
      const errorMsg = 'Неизвестная ошибка серверного Overpass API';
      if (statusCallback) statusCallback(`❌ Серверный API: ${errorMsg}`);
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.log(`❌ === ОШИБКА ЗАПРОСА К СЕРВЕРНОМУ OVERPASS ===`);
    console.log(`❌ Тип ошибки:`, error.name);
    console.log(`❌ Сообщение:`, error.message);
    
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
 * Конвертирует bounds в строку bbox
 * @param {Object} bounds - объект bounds с методами getSouth(), getWest(), getNorth(), getEast()
 * @returns {string} строка bbox в формате 'south,west,north,east'
 */
export function getBboxString(bounds) {
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();
  
  return `${south},${west},${north},${east}`;
}
