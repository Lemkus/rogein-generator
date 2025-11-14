// Версия приложения - ОБНОВЛЯТЬ ПРИ КАЖДОМ ДЕПЛОЕ!
const APP_VERSION = '1.12.56'; // Синхронизировано с index.html
const CACHE_NAME = `rogein-v${APP_VERSION}`;

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/app.js',
  '/src/modules/mapModule.js',
  '/src/modules/navigation.js',
  '/src/modules/pointGeneration.js',
  '/src/modules/routeSequence.js',
  '/src/modules/sequenceUI.js',
  '/src/modules/storageAPI.js',
  '/src/modules/optimizedOverpassAPI.js',
  '/src/modules/serverOverpassAPI.js',
  '/src/modules/audioModuleAdvanced.js',
  '/src/modules/fullscreenNavigation.js',
  '/src/modules/mediaSessionManager.js',
  '/src/modules/uiController.js',
  '/src/modules/utils.js',
  '/src/modules/config.js',
  '/src/modules/apiClient.js',
  '/src/modules/algorithms.js',
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js',
  'https://unpkg.com/leaflet-draw/dist/leaflet.draw.css',
  'https://unpkg.com/leaflet-draw/dist/leaflet.draw.js'
];

// Установка Service Worker - ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ
self.addEventListener('install', event => {
  console.log(`[SW] Установка новой версии ${APP_VERSION}`);
  // Пропускаем ожидание - сразу активируем новый SW
  self.skipWaiting();
  
  event.waitUntil(
    // Удаляем ВСЕ старые кеши перед установкой нового
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log(`[SW] Удаление старого кеша: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Создаем новый кеш, но НЕ кешируем при установке
      // Это гарантирует свежие версии при первом запросе
      return caches.open(CACHE_NAME);
    })
  );
});

// Активация Service Worker - удаляем ВСЕ старые кеши
self.addEventListener('activate', event => {
  console.log(`[SW] Активация версии ${APP_VERSION}`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем ВСЕ кеши, которые не текущий
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW] Удаление старого кеша: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Берем контроль над всеми клиентами немедленно
      console.log(`[SW] Берем контроль над всеми клиентами`);
      return self.clients.claim();
    }).then(() => {
      // Уведомляем все клиенты об обновлении
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// Перехват запросов - стратегия Network First для всех критичных ресурсов
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Для Service Worker - всегда из сети, без кеша
  if (url.pathname.includes('sw.js')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => new Response('', { status: 404 }))
    );
    return;
  }
  
  // Для HTML и главной страницы - Network First, НЕ кешируем
  if (request.method === 'GET' && (
    request.destination === 'document' || 
    url.pathname === '/' || 
    url.pathname.endsWith('.html') ||
    url.pathname === '/index.html'
  )) {
    event.respondWith(
      fetch(request, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
        .then(response => {
          // НЕ кешируем HTML - всегда свежий
          return response;
        })
        .catch(() => {
          // Только если сеть недоступна - берем из кеша
          return caches.match(request);
        })
    );
    return;
  }
  
  // Для JS и CSS модулей - Network First с обновлением кеша
  if (request.method === 'GET' && (
    url.pathname.startsWith('/src/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  )) {
    event.respondWith(
      fetch(request, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
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
          // Fallback на кеш только если сеть недоступна
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              console.log(`[SW] Используем кеш для ${url.pathname}`);
            }
            return cachedResponse || new Response('Network error', { status: 503 });
          });
        })
    );
    return;
  }
  
  // Для остальных ресурсов (изображения, шрифты) - Cache First с проверкой сети в фоне
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          // Проверяем в фоне, есть ли обновление
          fetch(request, { cache: 'no-store' })
            .then(networkResponse => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(() => {});
          return response;
        }
        
        // Если нет в кеше - запрашиваем из сети
        return fetch(request, { cache: 'no-store' }).then(response => {
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

// Обработка сообщений от клиента
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    });
  }
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
