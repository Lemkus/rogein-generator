/**
 * Модуль для работы с серверным Overpass API
 * Использует backend_simple.py вместо прямых запросов к overpass-api.de
 */

import { OVERPASS_API_BASE } from './config.js';

const REQUEST_TIMEOUT = 30000; // 30 секунд

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
 * Получает все данные (тропы + барьеры) через серверный Overpass API
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @returns {Promise<Object>}
 */
export async function fetchAllWithServerOverpass(bbox) {
  console.log(`🌍 Загружаем все данные через серверный Overpass API...`);
  
  const endpoint = `/all?bbox=${bbox}`;
  const data = await executeServerOverpassRequest(endpoint, 'Серверный Overpass все данные');
  
  if (data.success) {
    console.log(`✅ Серверный Overpass вернул ${data.paths_count} троп и ${data.barriers_count} барьеров`);
    return {
      paths: data.paths || [],
      barriers: data.barriers || []
    };
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
