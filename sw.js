// Версия приложения - ОБНОВЛЯТЬ ПРИ КАЖДОМ ДЕПЛОЕ!
const APP_VERSION = '1.12.2';
const CACHE_NAME = `rogein-v${APP_VERSION}`;

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/app.js',
  '/src/modules/mapModule.js',
  '/src/modules/navigation.js',
  '/src/modules/pointGeneration.js',
  '/src/modules/overpassAPI.js',
  '/src/modules/utils.js',
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js',
  'https://unpkg.com/leaflet-draw/dist/leaflet.draw.css',
  'https://unpkg.com/leaflet-draw/dist/leaflet.draw.js'
];

// Установка Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`Кэширование файлов для офлайн-работы (версия ${APP_VERSION})`);
        return cache.addAll(urlsToCache);
      })
  );
  // Принудительно активируем новый Service Worker
  self.skipWaiting();
});

// Активация Service Worker - удаляем ВСЕ старые кеши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем ВСЕ кеши, которые не текущий
          if (cacheName !== CACHE_NAME) {
            console.log('Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Берем контроль над всеми клиентами немедленно
      return self.clients.claim();
    })
  );
});

// Перехват запросов - стратегия Network First для HTML
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Для HTML и главной страницы используем Network First - всегда запрашиваем свежую версию
  if (request.method === 'GET' && (
    request.destination === 'document' || 
    url.pathname === '/' || 
    url.pathname.endsWith('.html') ||
    url.pathname === '/index.html'
  )) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Кешируем только успешные ответы
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Если сеть не доступна, берем из кеша как fallback
          return caches.match(request);
        })
    );
    return;
  }
  
  // Для Service Worker - всегда из сети
  if (url.pathname.includes('sw.js')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // Для остальных ресурсов - Cache First
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }
        
        // Если нет в кеше - запрашиваем из сети
        return fetch(request).then(response => {
          if (response.status === 200 && request.method === 'GET') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
  );
});

// Обработка push-уведомлений
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiM0Q0FGNTAiLz4KPHBhdGggZD0iTTk2IDQ4TDEwOCA2NEwxMjggNzJMMTA4IDgwTDk2IDk2TDg0IDgwTDY0IDcyTDg0IDY0TDk2IDQ4WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==',
    badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiByeD0iMTIiIGZpbGw9IiM0Q0FGNTAiLz4KPHBhdGggZD0iTTQ4IDI0TDU0IDMyTDY0IDM2TDU0IDQwTDQ4IDQ4TDQyIDQwTDMyIDM2TDQyIDMyTDQ4IDI0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==',
    vibrate: [200, 100, 200],
    tag: 'rogein-notification'
  };
  
  event.waitUntil(
    self.registration.showNotification('Рогейн', options)
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});
