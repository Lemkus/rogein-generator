/**
 * Оптимизированный модуль для работы с Overpass API
 * Минимизирует количество запросов, объединяя все данные в один запрос
 */

import { OVERPASS_API_BASE } from './config.js';

const REQUEST_TIMEOUT = 30000; // 30 секунд

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
 * Загружает все данные через клиентский Overpass API
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
  
  // Единый запрос для всех типов данных
  const query = `[out:json][timeout:60];
(
  way["highway"~"^(path|footway|cycleway|track|service|bridleway|unclassified|residential|living_street|steps|pedestrian)$"](${south},${west},${north},${east});
  way["barrier"="wall"](${south},${west},${north},${east});
  way["natural"="cliff"](${south},${west},${north},${east});
  way["military"~"^(yes|restricted|prohibited)$"](${south},${west},${north},${east});
  way["access"~"^(no|private|restricted)$"](${south},${west},${north},${east});
);
out geom;`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      signal: controller.signal,
      headers: { 'Content-Type': 'text/plain' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Ошибка загрузки данных (${response.status})`);
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
      if (element.type === 'way' && element.geometry) {
        const geometry = element.geometry.map(coord => [coord.lat, coord.lon]);
        
        if (geometry.length >= 2) {
          const tags = element.tags || {};
          const highway = tags.highway || '';
          const barrier = tags.barrier || '';
          const natural = tags.natural || '';
          const military = tags.military || '';
          const access = tags.access || '';
          
          if (highway) {
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
          } else if (barrier || natural === 'cliff') {
            result.barriers.push({
              geometry: geometry,
              type: 'barrier',
              barrier_type: barrier,
              natural: natural,
              osmid: String(element.id)
            });
            barrierCount++;
          } else if (military || access === 'no' || access === 'private' || access === 'restricted') {
            result.closed_areas.push({
              geometry: geometry,
              type: 'closed_area',
              military: military,
              access: access,
              name: tags.name || '',
              osmid: String(element.id)
            });
            closedAreaCount++;
          }
        }
      }
    }
    
          statusCallback(`Загружено: ${pathCount} дорог, ${barrierCount} барьеров, ${closedAreaCount} закрытых зон`);
    
    // Кэшируем данные
    if (!window.mapDataCache) window.mapDataCache = {};
    window.mapDataCache[`all_data_${bbox}`] = result;
    
    return result;
    
  } catch (error) {
    throw error;
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
