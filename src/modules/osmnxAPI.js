/**
 * Модуль для работы с OSMnx Backend API
 * Предоставляет быструю загрузку данных OpenStreetMap через Python backend
 */

import { OSMNX_API_BASE, CONFIG_VERSION } from './config.js';
const REQUEST_TIMEOUT = 30000; // 30 секунд
const MAX_RETRIES = 3; // Максимальное количество повторных попыток
const RETRY_DELAY = 1000; // Задержка между попытками в мс

// Логируем версию конфигурации для диагностики кэширования
console.log(`🔧 OSMnx API модуль загружен, версия конфигурации: ${CONFIG_VERSION}`);
console.log(`🌐 OSMNX_API_BASE: ${OSMNX_API_BASE}`);

/**
 * Универсальная функция для выполнения OSMnx запросов с retry логикой
 * @param {string} endpoint - путь к API endpoint
 * @param {string} description - описание запроса для логирования
 * @param {number} timeout - таймаут запроса в мс
 * @param {number} maxRetries - максимальное количество попыток
 * @returns {Promise<Object>}
 */
async function executeOSMnxRequest(endpoint, description, timeout = REQUEST_TIMEOUT, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      console.log(`🔄 ${description}: попытка ${attempt}/${maxRetries} - ${OSMNX_API_BASE}${endpoint}`);
    
      const response = await fetch(`${OSMNX_API_BASE}${endpoint}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
      console.log(`📡 ${description}: получен ответ HTTP ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        // Попробуем прочитать текст ошибки для диагностики
        let errorText = '';
        try {
          errorText = await response.text();
          console.log(`📄 ${description}: тело ответа ошибки:`, errorText);
        } catch (textError) {
          console.log(`📄 ${description}: не удалось прочитать тело ответа ошибки:`, textError.message);
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }
      
      // Попытка парсинга JSON с детальной диагностикой
      let data;
      try {
        const responseText = await response.text();
        console.log(`📄 ${description}: тело ответа:`, responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
        
        data = JSON.parse(responseText);
        console.log(`📊 ${description}: парсинг JSON успешен, структура:`, Object.keys(data));
        
      } catch (jsonError) {
        console.log(`❌ ${description}: ошибка парсинга JSON:`, jsonError.message);
        throw new Error(`Неверный формат ответа JSON: ${jsonError.message}`);
      }
      
      // Проверяем структуру ответа - поддерживаем разные форматы backend
      if (data.success !== undefined) {
        // Формат OSMnx backend: {success: true/false, ...}
        if (!data.success) {
          const errorMsg = data.error || data.message || 'Неизвестная ошибка API';
          console.log(`❌ ${description}: API вернул success=false, ошибка:`, errorMsg);
          throw new Error(errorMsg);
        }
        console.log(`✅ ${description}: OSMnx backend формат`);
      } else if (data.status !== undefined) {
        // Формат simple backend: {status: "healthy", backend_type: "simple_overpass", ...}
        if (data.status !== 'healthy') {
          const errorMsg = `Backend статус: ${data.status}`;
          console.log(`❌ ${description}: простой backend вернул нездоровый статус:`, data.status);
          throw new Error(errorMsg);
        }
        console.log(`✅ ${description}: простой backend формат (${data.backend_type})`);
        
        // Преобразуем в стандартный формат для совместимости
        data.success = true;
        data.message = `Simple backend (${data.backend_type}) is healthy`;
      } else {
        // Неизвестный формат
        console.log(`⚠️ ${description}: неизвестная структура ответа:`, data);
        throw new Error(`Неожиданная структура ответа API - отсутствуют поля 'success' и 'status'`);
      }
      
      // Успешный запрос
      if (attempt > 1) {
        console.log(`✅ ${description}: успех с ${attempt}-й попытки`);
      } else {
        console.log(`✅ ${description}: успех с первой попытки`);
      }
      
      return data;
      
    } catch (error) {
      lastError = error;
      
      if (error.name === 'AbortError') {
        console.log(`⏰ ${description}: таймаут ${timeout}мс (попытка ${attempt}/${maxRetries})`);
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.log(`🌐 ${description}: ошибка сети - возможно backend не запущен (попытка ${attempt}/${maxRetries}):`, error.message);
      } else {
        console.log(`❌ ${description}: ошибка (попытка ${attempt}/${maxRetries}):`, error.message);
      }
      
      // Если это не последняя попытка, ждем перед повтором
      if (attempt < maxRetries) {
        const delay = RETRY_DELAY * attempt;
        console.log(`⏳ ${description}: ожидание ${delay}мс перед повтором...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Все попытки исчерпаны
  console.log(`💥 ${description}: все ${maxRetries} попыток исчерпаны, последняя ошибка:`, lastError.message);
  throw lastError;
}

/**
 * Быстрая проверка доступности OSMnx backend без детального логирования
 * @returns {Promise<boolean>}
 */
async function quickHealthCheck() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Быстрая проверка
    
    const response = await fetch(`${OSMNX_API_BASE}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Проверяет доступность OSMnx backend
 * @returns {Promise<boolean>}
 */
export async function isOSMnxBackendAvailable() {
  // Сначала быстрая проверка
  console.log('🔍 Быстрая проверка OSMnx backend...');
  const quickCheck = await quickHealthCheck();
  
  if (!quickCheck) {
    console.log('❌ OSMnx Backend недоступен (быстрая проверка)');
    return false;
  }
  
  // Если быстрая проверка прошла, делаем полную проверку
  try {
    const data = await executeOSMnxRequest('/health', 'Полная проверка доступности', 5000, 1);
    console.log('✅ OSMnx Backend доступен:', data);
    return true;
  } catch (error) {
    console.log('❌ OSMnx Backend недоступен (полная проверка):', error.message);
    return false;
  }
}

/**
 * Конвертирует координаты из формата OSMnx в формат frontend
 * @param {Array} geometry - массив координат [lat, lon]
 * @returns {Array} - массив координат в формате frontend
 */
function convertGeometryFormat(geometry) {
  if (!Array.isArray(geometry)) {
    return [];
  }
  
  // Оптимизированная конвертация - одно прохождение вместо filter + map
  const result = [];
  for (let i = 0; i < geometry.length; i++) {
    const coord = geometry[i];
    
    // Быстрые проверки в порядке вероятности отказа
    if (!Array.isArray(coord) || coord.length < 2) continue;
    
    const lat = coord[0];
    const lon = coord[1];
    
    // Объединяем проверки типов и валидности
    if (typeof lat === 'number' && typeof lon === 'number' && 
        !isNaN(lat) && !isNaN(lon) && 
        isFinite(lat) && isFinite(lon)) {
      result.push({ lat, lon });
    }
  }
  
  return result;
}

/**
 * Загружает пешеходные маршруты через OSMnx backend
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @param {string} pathType - тип пути (для логирования)
 * @returns {Promise<Array>}
 */
export async function fetchPathsWithOSMnx(bbox, pathType = 'пешеходные маршруты') {
    console.log(`🔄 Загружаем ${pathType} через OSMnx backend...`);
    
  const data = await executeOSMnxRequest(`/paths?bbox=${bbox}`, `OSMnx ${pathType}`);
    
    console.log(`✅ OSMnx: загружено ${data.count} ${pathType} за ${data.load_time}с`);
    
    // Конвертируем данные в формат, ожидаемый frontend
    const convertedPaths = data.data.map(path => ({
      geometry: convertGeometryFormat(path.geometry),
      highway: path.highway || 'unknown',
      name: path.name || '',
      surface: path.surface || '',
      access: path.access || '',
      osmid: path.osmid || '',
      length: path.length || 0
    })).filter(path => path.geometry.length >= 2); // Фильтруем пустые геометрии
    
    console.log(`✅ OSMnx: конвертировано ${convertedPaths.length} валидных путей`);
    console.log('🔍 OSMnx возвращает:', {
      isArray: Array.isArray(convertedPaths),
      length: convertedPaths.length,
      firstItem: convertedPaths[0],
      sampleGeometry: convertedPaths[0]?.geometry?.slice(0, 3)
    });
    
    return convertedPaths;
}

/**
 * Загружает барьеры через OSMnx backend
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @returns {Promise<Array>}
 */
export async function fetchBarriersWithOSMnx(bbox) {
    console.log('🔄 Загружаем барьеры через OSMnx backend...');
    
  const data = await executeOSMnxRequest(`/barriers?bbox=${bbox}`, 'OSMnx барьеры');
    
    console.log(`✅ OSMnx: загружено ${data.count} барьеров за ${data.load_time}с`);
    
    // Конвертируем данные в формат, ожидаемый frontend
    const convertedBarriers = data.data.map(barrier => ({
      geometry: convertGeometryFormat(barrier.geometry),
      type: 'barrier',
      barrier_type: barrier.barrier_type || '',
      natural: barrier.natural || '',
      waterway: barrier.waterway || '',
      name: barrier.name || '',
      osmid: barrier.osmid || ''
    })).filter(barrier => barrier.geometry.length >= 2);
    
    console.log(`✅ OSMnx: конвертировано ${convertedBarriers.length} валидных барьеров`);
    
    return convertedBarriers;
}

/**
 * Загружает все данные (тропы + барьеры) через OSMnx backend
 * @param {string} bbox - строка bbox в формате 'south,west,north,east'
 * @returns {Promise<Object>} - объект с paths и barriers
 */
export async function fetchAllWithOSMnx(bbox) {
    console.log('🔄 Загружаем все данные через OSMnx backend...');
    
  const data = await executeOSMnxRequest(`/all?bbox=${bbox}`, 'OSMnx все данные');
    
    console.log(`✅ OSMnx: загружено ${data.paths_count} путей и ${data.barriers_count} барьеров за ${data.load_time}с`);
    
    // Конвертируем данные
    const convertedPaths = data.paths.map(path => ({
      geometry: convertGeometryFormat(path.geometry),
      highway: path.highway || 'unknown',
      name: path.name || '',
      surface: path.surface || '',
      access: path.access || '',
      osmid: path.osmid || '',
      length: path.length || 0
    })).filter(path => path.geometry.length >= 2);
    
    const convertedBarriers = data.barriers.map(barrier => ({
      geometry: convertGeometryFormat(barrier.geometry),
      type: 'barrier',
      barrier_type: barrier.barrier_type || '',
      natural: barrier.natural || '',
      waterway: barrier.waterway || '',
      name: barrier.name || '',
      osmid: barrier.osmid || ''
    })).filter(barrier => barrier.geometry.length >= 2);
    
    console.log(`✅ OSMnx: конвертировано ${convertedPaths.length} путей и ${convertedBarriers.length} барьеров`);
    
    return {
      paths: convertedPaths,
      barriers: convertedBarriers
    };
}

/**
 * Получает строку bbox из границ карты
 * @param {Object} bounds - границы карты Leaflet
 * @returns {string} - строка bbox в формате 'south,west,north,east'
 */
export function getBboxString(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
}
