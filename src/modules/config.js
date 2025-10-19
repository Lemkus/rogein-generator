/**
 * Конфигурация API для приложения
 */

// Базовый URL для серверного Overpass API
export const OVERPASS_API_BASE = 'https://trailspot.app/api';

// Таймауты для запросов
export const REQUEST_TIMEOUTS = {
  SHORT: 10000,    // 10 секунд для быстрых запросов
  MEDIUM: 30000,   // 30 секунд для обычных запросов
  LONG: 60000      // 60 секунд для сложных запросов
};

// Настройки для retry логики
export const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  DELAY_BETWEEN_ATTEMPTS: 2000, // 2 секунды
  BACKOFF_MULTIPLIER: 1.5
};

// Настройки для кэширования
export const CACHE_CONFIG = {
  TTL: 300000, // 5 минут в миллисекундах
  MAX_SIZE: 50 // максимум 50 записей в кэше
};