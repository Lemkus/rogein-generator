const isGithub = typeof location !== 'undefined' && location.host.endsWith('github.io');

// Укажи здесь публичные адреса, когда развернёшь бэкенды (HTTPS)
// Временные локальные значения остаются для разработки
export const BACKEND_SIMPLE_BASE = isGithub
  ? 'https://your-fastapi.example.com'
  : 'http://31.31.196.9:8080';

// Server-side Overpass API (Simple Backend)
export const OVERPASS_API_BASE = isGithub
  ? 'https://your-overpass.example.com/api'
  : 'http://31.31.196.9:5000/api';

// Версия конфигурации для принудительного обновления кэша
export const CONFIG_VERSION = 'v1.5.0'; // OSMnx removed, only Overpass API


