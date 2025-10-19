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
    return window.mapDataCache[cacheKey];
  }
  
  statusCallback('Загружаем данные карты...');
  
  try {
    // Сначала пробуем серверный API
    const serverData = await fetchAllWithServerOverpass(bbox, statusCallback);
    if (serverData) {
      // Кэшируем данные
      if (!window.mapDataCache) window.mapDataCache = {};
      window.mapDataCache[cacheKey] = serverData;
      return serverData;
    }
  } catch (error) {
    // Серверный API недоступен, используем клиентский
  }
  
  // Если серверный API недоступен, используем клиентский
  statusCallback('Загружаем данные из OpenStreetMap...');
  return await fetchAllWithClientOverpass(bbox, statusCallback);
}

/**
 * Загружает все данные через серверный API
 */
async function fetchAllWithServerOverpass(bbox, statusCallback) {
  try {
    const response = await fetch(`${OVERPASS_API_BASE}/all?bbox=${bbox}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Серверный API недоступен (${response.status})`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      statusCallback(`Загружено: ${data.counts.paths} дорог, ${data.counts.barriers} барьеров, ${data.counts.closed_areas} закрытых зон`);
      return data.data;
    } else {
      throw new Error(data.error || 'Ошибка серверного API');
    }
  } catch (error) {
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
 * Загружает все данные через клиентский Overpass API с retry логикой
 */
async function fetchAllWithClientOverpass(bbox, statusCallback) {
  const [south, west, north, east] = bbox.split(',').map(Number);
  
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
  
  // Единый запрос для всех типов данных с уменьшенным таймаутом
  const query = `[out:json][timeout:30];
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
  relation["access"="no"](${south},${west},${north},${east});
  way["access"="restricted"](${south},${west},${north},${east});
  relation["access"="restricted"](${south},${west},${north},${east});
);
out geom;`;

  let lastError;
  
  // Retry логика
  for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
    try {
      statusCallback(`Загрузка данных OSM (попытка ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Таймаут ${REQUEST_TIMEOUT}мс превышен на попытке ${attempt}`);
        controller.abort();
      }, REQUEST_TIMEOUT);
      
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        signal: controller.signal,
        headers: { 'Content-Type': 'text/plain' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 504 || response.status === 429) {
          // Gateway timeout или rate limit - пробуем еще раз
          throw new Error(`Сервер перегружен (${response.status}), попытка ${attempt}`);
        } else {
          throw new Error(`Ошибка загрузки данных (${response.status})`);
        }
      }
      
      const data = await response.json();
      
      // Парсим данные
      const result = {
        paths: [],
        barriers: [],
        closed_areas: [],
        water_areas: []
      };
      
      let pathCount = 0;
      let barrierCount = 0;
      let closedAreaCount = 0;
      
      
      for (const element of data.elements) {
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
            
            
            // Сначала проверяем на запретные зоны (приоритет)
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
            } else if (highway) {
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
            } else if (barrier) {
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
      
      statusCallback(`✅ Загружено: ${pathCount} дорог, ${barrierCount} барьеров, ${closedAreaCount} закрытых зон`);
      
      // Кэшируем данные
      if (!window.mapDataCache) window.mapDataCache = {};
      window.mapDataCache[`all_data_${bbox}`] = result;
      
      return result;
      
    } catch (error) {
      lastError = error;
      console.log(`❌ Попытка ${attempt} неудачна:`, error.message);
      
      // Если это последняя попытка, выбрасываем ошибку
      if (attempt === RETRY_CONFIG.MAX_ATTEMPTS) {
        throw new Error(`Не удалось загрузить данные после ${RETRY_CONFIG.MAX_ATTEMPTS} попыток. Последняя ошибка: ${error.message}`);
      }
      
      // Ждем перед следующей попыткой
      const delayTime = RETRY_CONFIG.DELAY_BETWEEN_ATTEMPTS * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
      statusCallback(`⏳ Повторная попытка через ${Math.round(delayTime/1000)}с...`);
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
