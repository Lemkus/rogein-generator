/**
 * Оптимизированный модуль для работы с Overpass API
 * Минимизирует количество запросов, объединяя все данные в один запрос
 * Использует serverOverpassAPI.js для работы с серверным API (без дублирования кода)
 */

import { REQUEST_TIMEOUTS, RETRY_CONFIG } from './config.js';
import { fetchAllWithServerOverpass, buildOverpassQuery } from './serverOverpassAPI.js';

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
    const serverResponse = await fetchAllWithServerOverpass(bbox, statusCallback);
    
    // Парсим данные из серверного ответа
    if (serverResponse && serverResponse.elements) {
      const parsedData = parseOverpassData(serverResponse.elements, statusCallback);
      
      // Кэшируем данные
      if (!window.mapDataCache) window.mapDataCache = {};
      window.mapDataCache[cacheKey] = parsedData;
      statusCallback('✅ Данные успешно загружены через серверный API');
      return parsedData;
    } else {
      throw new Error('Серверный API вернул некорректные данные');
    }
  } catch (error) {
    statusCallback(`❌ Серверный API недоступен: ${error.message}`);
    console.log(`❌ Серверный API ошибка:`, error);
    
    // Если серверный API недоступен, используем клиентский
    statusCallback('🔄 Переключаемся на клиентский Overpass API...');
    return await fetchAllWithClientOverpass(bbox, statusCallback);
  }
}

/**
 * Загружает все данные через серверный API
 * Функция удалена - теперь используется fetchAllWithServerOverpass из serverOverpassAPI.js
 * Это устраняет дублирование кода (DRY принцип)
 */

/**
 * Задержка между попытками
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Единая функция формирования Overpass запроса
 * Используется как для серверного, так и для клиентского API
 * Импортируется из serverOverpassAPI.js для избежания дублирования (DRY принцип)
 */

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

  console.log(`🔄 Начинаем парсинг ${elements.length} элементов...`);

  for (const element of elements || []) {
    // Проверяем наличие geometry (для запросов с out geom)
    // или nodes (для обычных запросов)
    let geometry = null;
    
    if (element.geometry && Array.isArray(element.geometry)) {
      // Формат с geometry (out geom)
      geometry = element.geometry.map(coord => [coord.lat, coord.lon]);
    } else if (element.nodes && Array.isArray(element.nodes)) {
      // Формат с nodes - нужно будет получить координаты из nodes
      // Но для этого нужны сами node элементы в ответе
      // Пока пропускаем такие элементы
      skippedCount++;
      continue;
    } else if (element.type === 'way' && element.lat !== undefined && element.lon !== undefined) {
      // Одиночная точка
      geometry = [[element.lat, element.lon]];
    } else {
      skippedCount++;
      continue;
    }
    
    if ((element.type === 'way' || element.type === 'relation') && geometry) {
      
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

  console.log(`✅ Парсинг завершен: ${pathCount} дорог, ${barrierCount} барьеров, ${closedAreaCount} закрытых зон, ${skippedCount} пропущено`);
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
  
  // Используем единую функцию формирования запроса из serverOverpassAPI.js
  const query = buildOverpassQuery(bbox);

  let lastError;
  
  // Retry логика
  for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
    try {
      statusCallback(`🔄 Клиентский API: попытка ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS} (таймаут ${REQUEST_TIMEOUT/1000}с)...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Таймаут ${REQUEST_TIMEOUT}мс превышен на попытке ${attempt}`);
        statusCallback(`⏰ Клиентский API: таймаут ${REQUEST_TIMEOUT/1000}с на попытке ${attempt}`);
        controller.abort();
      }, REQUEST_TIMEOUT);
      
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
      
      // Проверяем Content-Type перед чтением ответа
      const contentType = response.headers.get('content-type') || '';
      
      // Читаем ответ как текст (можно прочитать только один раз)
      let responseText = '';
      try {
        responseText = await response.text();
      } catch (textError) {
        console.log(`📄 Не удалось прочитать тело ответа:`, textError.message);
        throw new Error(`Не удалось прочитать ответ сервера: ${textError.message}`);
      }
      
      if (!response.ok) {
        // Извлекаем сообщение об ошибке из XML, если это XML ответ
        let errorMessage = '';
        if (contentType.includes('xml') || contentType.includes('html') || responseText.includes('<?xml') || responseText.includes('<html')) {
          // Пытаемся извлечь сообщение об ошибке из XML
          const errorMatch = responseText.match(/<strong[^>]*>Error<\/strong>.*?<p[^>]*>([^<]+)<\/p>/is);
          if (errorMatch) {
            errorMessage = errorMatch[1].trim();
          } else {
            errorMessage = 'Сервер Overpass API перегружен или недоступен';
          }
        } else {
          // Пытаемся распарсить как JSON для получения сообщения об ошибке
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || responseText.substring(0, 200);
          } catch (e) {
            errorMessage = responseText.substring(0, 200);
          }
        }
        
        if (response.status === 504 || response.status === 429) {
          // Gateway timeout или rate limit - пробуем еще раз
          statusCallback(`⚠️ Клиентский API: сервер перегружен (${response.status}${errorMessage ? `: ${errorMessage}` : ''}), попытка ${attempt}`);
          throw new Error(`Сервер перегружен (${response.status}${errorMessage ? `: ${errorMessage}` : ''}), попытка ${attempt}`);
        } else {
          statusCallback(`❌ Клиентский API: ошибка загрузки (${response.status}${errorMessage ? `: ${errorMessage}` : ''})`);
          throw new Error(`Ошибка загрузки данных (${response.status}${errorMessage ? `: ${errorMessage}` : ''})`);
        }
      }
      
      // Проверяем, что ответ действительно JSON
      if (responseText.includes('<?xml') || responseText.includes('<html')) {
        statusCallback(`❌ Клиентский API: получен XML/HTML ответ вместо JSON`);
        throw new Error('Сервер вернул некорректный формат данных (XML/HTML вместо JSON)');
      }
      
      // Парсим JSON с обработкой ошибок
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        statusCallback(`❌ Клиентский API: ошибка парсинга JSON: ${parseError.message}`);
        console.log(`📄 Сырой ответ (первые 500 символов):`, responseText.substring(0, 500));
        throw new Error(`Ошибка парсинга ответа: ${parseError.message}`);
      }
      
      if (!data || !data.elements) {
        statusCallback(`❌ Клиентский API: некорректный формат данных`);
        console.log(`❌ Структура данных:`, data);
        throw new Error('Некорректный формат данных от клиентского API');
      }
      
      console.log(`📊 Клиентский API: получено ${data.elements.length} элементов`);
      if (data.elements.length > 0) {
        console.log(`📊 Пример первого элемента:`, {
          type: data.elements[0].type,
          id: data.elements[0].id,
          hasGeometry: !!data.elements[0].geometry,
          hasNodes: !!data.elements[0].nodes,
          tags: data.elements[0].tags
        });
      }
      
      // Используем единую функцию парсинга
      const result = parseOverpassData(data.elements, statusCallback);
      
      console.log(`📊 Результат парсинга:`, {
        paths: result.paths.length,
        barriers: result.barriers.length,
        closed_areas: result.closed_areas.length,
        water_areas: result.water_areas.length
      });
      
      // Кэшируем данные
      if (!window.mapDataCache) window.mapDataCache = {};
      window.mapDataCache[`all_data_${bbox}`] = result;
      
      return result;
      
    } catch (error) {
      lastError = error;
      console.log(`❌ Попытка ${attempt} неудачна:`, error.message);
      console.log(`❌ Тип ошибки:`, error.name);
      
      // Если это AbortError (таймаут), не делаем retry для последней попытки
      if (error.name === 'AbortError') {
        statusCallback(`⏰ Клиентский API: запрос прерван по таймауту на попытке ${attempt}`);
        if (attempt === RETRY_CONFIG.MAX_ATTEMPTS) {
          statusCallback(`❌ Клиентский API: не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток (таймауты)`);
          throw new Error(`Не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток. Все запросы превысили таймаут ${REQUEST_TIMEOUT/1000}с`);
        }
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        statusCallback(`🌐 Клиентский API: ошибка сети на попытке ${attempt}`);
        if (attempt === RETRY_CONFIG.MAX_ATTEMPTS) {
          statusCallback(`❌ Клиентский API: не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток (ошибка сети)`);
          throw new Error(`Не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток. Ошибка сети: ${error.message}`);
        }
      } else {
        // Другие ошибки
        if (attempt === RETRY_CONFIG.MAX_ATTEMPTS) {
          statusCallback(`❌ Клиентский API: не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток`);
          throw new Error(`Не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток. Последняя ошибка: ${error.message}`);
        }
      }
      
      // Ждем перед следующей попыткой (только если не последняя)
      if (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
        const delayTime = RETRY_CONFIG.DELAY_BETWEEN_ATTEMPTS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
        statusCallback(`⏳ Клиентский API: повторная попытка через ${Math.round(delayTime/1000)}с...`);
        await delay(delayTime);
      }
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

