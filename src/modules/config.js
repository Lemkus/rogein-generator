const isGithub = typeof location !== 'undefined' && location.host.endsWith('github.io');

// Укажи здесь публичные адреса, когда развернёшь бэкенды (HTTPS)
// Временные локальные значения остаются для разработки
export const BACKEND_SIMPLE_BASE = isGithub
  ? 'https://your-fastapi.example.com'
  : 'http://127.0.0.1:8001';

export const OSMNX_API_BASE = isGithub
  ? 'https://your-osmnx.example.com/api'
  : 'http://localhost:5000/api';


