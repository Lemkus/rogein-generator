/**
 * Главный модуль приложения
 * Инициализирует все компоненты и связывает их между собой
 */

console.log('🚀 app.js загружается...');

import { initMap, map, drawnItems, pointMarkers, getSelectedBounds, getStartPoint, updateSelectedBounds, updateStartPointPosition, clearPointMarkers } from './modules/mapModule.js';
import { initNavigation, updateTargetPointsList, resetCompletedPoints } from './modules/navigation.js';
import { generatePoints, cancelPointGeneration, downloadGPX } from './modules/pointGeneration.js';
import './modules/audioModuleAdvanced.js'; // Инициализация продвинутого аудио модуля
import { saveRoute, getRouteById, getRoutesList, buildShareUrl } from './modules/storageAPI.js';
import { BACKEND_SIMPLE_BASE } from './modules/config.js';
import { initSequenceUI, generateAndDisplaySequence } from './modules/sequenceUI.js';
import { resetSequence } from './modules/routeSequence.js';
import { initFullscreenNavigation } from './modules/fullscreenNavigation.js';
import { initMediaSession } from './modules/mediaSessionManager.js';
import { clearMapDataCache } from './modules/optimizedOverpassAPI.js';
import { initUI, setStep as setUIStep, addApiLog, updateInfoPanel, showInfoPanel } from './modules/uiController.js';

// DOM элементы (будут инициализированы в initApp)
let pointsInput, zoomInBtn, zoomOutBtn, gpsBtn;
let routesModal, routesModalClose, routesList, routesListEmpty;
let shareBtn, sequenceLink, startNavBtn;
let lastSavedRouteId = null;

// Инициализация приложения
export function initApp() {
  console.log('🚀 Инициализация приложения TrailSpot...');
  
  // Инициализируем DOM элементы
  pointsInput = document.getElementById('pointsCount');
  zoomInBtn = document.getElementById('zoomInBtn');
  zoomOutBtn = document.getElementById('zoomOutBtn');
  gpsBtn = document.getElementById('gpsBtn');
  shareBtn = document.getElementById('shareBtn');
  routesModal = document.getElementById('routesModal');
  routesModalClose = document.getElementById('routesModalClose');
  routesList = document.getElementById('routesList');
  routesListEmpty = document.getElementById('routesListEmpty');
  sequenceLink = document.getElementById('sequenceLink');
  startNavBtn = document.getElementById('startNavBtn');
  
  // Инициализируем модули
  initMap();
  initUI(); // Новый UI контроллер
  initNavigation();
  initSequenceUI();
  initFullscreenNavigation();
  initMediaSession();
  
  // Настраиваем обработчики событий
  setupEventHandlers();
  
  // Обработчик изменения ориентации экрана для пересчета размеров карты
  setupOrientationHandler();

  // Автозагрузка из URL (?routeId=...)
  bootstrapFromUrl();
  
  // Экспорт для глобального доступа (временно, для совместимости)
  updateGlobalVars();
  setInterval(updateGlobalVars, 1000); // Обновляем каждую секунду
  
  addApiLog('✅ Приложение готово к работе');
  console.log('✅ Приложение инициализировано');
}

// Обработчик изменения ориентации экрана
function setupOrientationHandler() {
  // Функция для пересчета размеров карты при изменении ориентации
  function invalidateMapSize() {
    if (map && map.invalidateSize) {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }
  
  // Обработчик изменения ориентации
  window.addEventListener('orientationchange', () => {
    invalidateMapSize();
  });
  
  // Обработчик изменения размера окна
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768 && window.matchMedia('(orientation: landscape)').matches) {
      invalidateMapSize();
    }
  });
}

// Настройка обработчиков событий
function setupEventHandlers() {
  // Zoom кнопки
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      if (map) map.zoomIn();
    });
  }
  
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      if (map) map.zoomOut();
    });
  }
  
  // GPS кнопка
  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
      if ('geolocation' in navigator) {
        addApiLog('Определение позиции...');
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            if (map) {
              map.setView([latitude, longitude], 16);
              addApiLog(`Позиция: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            }
          },
          (error) => {
            addApiLog('❌ Ошибка определения позиции');
            console.error('Geolocation error:', error);
          }
        );
      } else {
        addApiLog('❌ Геолокация недоступна');
      }
    });
  }
  
  // Кнопка "Поделиться"
  if (shareBtn) {
    shareBtn.addEventListener('click', handleShareRoute);
  }
  
  // Кнопка "Начать навигацию"
  if (startNavBtn) {
    startNavBtn.addEventListener('click', () => {
      import('./modules/navigation.js').then(nav => {
        // Запуск навигации
        addApiLog('🎯 Запуск навигации...');
      });
    });
  }
  
  // Ссылка на последовательность
  if (sequenceLink) {
    sequenceLink.addEventListener('click', (e) => {
      e.preventDefault();
      const sequenceModal = document.getElementById('sequenceModal');
      if (sequenceModal) {
        sequenceModal.style.display = 'flex';
      }
    });
  }

  // Модалка маршрутов
  if (routesModalClose) {
    routesModalClose.addEventListener('click', closeRoutesModal);
  }
  if (routesModal) {
    routesModal.addEventListener('click', (e) => { 
      if (e.target === routesModal) closeRoutesModal(); 
    });
  }
}

// Обработчик клика по кнопке генерации
async function handleGenerateClick() {
  const count = parseInt(pointsInput.value, 10);
  
  // Получаем уровень сложности из настроек
  const difficultyLevelSelect = document.getElementById('difficultyLevel');
  const difficultyLevel = difficultyLevelSelect ? parseInt(difficultyLevelSelect.value) : 2;
  
  // Сбрасываем старую последовательность и завершенные точки
  resetSequence();
  resetCompletedPoints();
  
  // Очищаем кэш картографических данных для свежих данных
  clearMapDataCache();
  
  // Получаем текущие значения из mapModule
  const selectedBounds = getSelectedBounds();
  const startPoint = getStartPoint();
  
  // Проверяем что область выбрана
  if (!selectedBounds || !selectedBounds.south || !selectedBounds.west || !selectedBounds.north || !selectedBounds.east) {
    updateStatus('❌ Сначала выберите область на карте, нарисовав прямоугольник');
    return;
  }
  
  await generatePoints(
    selectedBounds,
    startPoint,
    count,
    difficultyLevel,
    updateStatus,
    toggleGenerateButton,
    toggleCancelButton
  );
  
  // После генерации точек создаем оптимальную последовательность
  if (pointMarkers && pointMarkers.length > 0) {
    setTimeout(async () => {
      await generateAndDisplaySequence();
      updateTargetPointsList(); // Обновляем список точек с новой последовательностью
    }, 500); // Небольшая задержка для завершения отрисовки точек
  }
}

// Обработчик клика по кнопке отмены
function handleCancelClick() {
  cancelPointGeneration();
  updateStatus('Отмена...');
  console.log('Генерация отменена пользователем.');
}

// Обработчик скачивания GPX
function handleDownloadGPX() {
  downloadGPX();
}

// Сохранение маршрута в backend
async function handleSaveRoute() {
  try {
    const selectedBounds = getSelectedBounds();
    const startPoint = getStartPoint();
    if (!selectedBounds || !startPoint) {
      updateStatus('Нужны прямоугольник и точка старта для сохранения');
      return;
    }
    if (!pointMarkers || pointMarkers.length === 0) {
      updateStatus('Нет сгенерированных точек для сохранения');
      return;
    }

    const points = pointMarkers.map((m, idx) => {
      const ll = m.getLatLng();
      return { lat: ll.lat, lon: ll.lng, name: String(idx + 1) };
    });

    const name = prompt('Название маршрута:', `Маршрут ${new Date().toLocaleString()}`) || 'Маршрут';
    const description = 'Сгенерированное распределение точек';

    const boundsPayload = {
      south: selectedBounds.getSouth(),
      west: selectedBounds.getWest(),
      north: selectedBounds.getNorth(),
      east: selectedBounds.getEast()
    };

    const route = await saveRoute({ name, description, points, startPoint, bounds: boundsPayload });
    lastSavedRouteId = route.id;
    updateStatus(`Сохранено (ID: ${route.id})`);
  } catch (e) {
    console.error(e);
    updateStatus('Ошибка сохранения маршрута');
  }
}

// ===== МОДАЛКА МАРШРУТОВ =====
function openRoutesModal() {
  renderRoutesList();
  routesModal.style.display = 'flex';
}

function closeRoutesModal() {
  routesModal.style.display = 'none';
}

async function renderRoutesList() {
  try {
    routesList.innerHTML = '';
    const list = await getRoutesList();
    if (!Array.isArray(list) || list.length === 0) {
      routesListEmpty.style.display = 'block';
      return;
    }
    routesListEmpty.style.display = 'none';

    list.forEach((r) => {
      const item = document.createElement('div');
      item.style.border = '1px solid #eee';
      item.style.borderRadius = '8px';
      item.style.padding = '10px';
      item.style.display = 'grid';
      item.style.gap = '6px';

      const title = document.createElement('div');
      title.style.fontWeight = '600';
      title.textContent = r.name || 'Без названия';

      const meta = document.createElement('div');
      meta.style.color = '#777';
      meta.style.fontSize = '12px';
      meta.textContent = r.id;

      const actions = document.createElement('div');
      actions.style.display = 'grid';
      actions.style.gridTemplateColumns = '1fr 1fr';
      actions.style.gap = '6px';

      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Загрузить';
      loadBtn.style.margin = '0';
      loadBtn.addEventListener('click', async () => {
        const route = await getRouteById(r.id);
        if (!route) { updateStatus('Маршрут не найден'); return; }
        renderRouteOnMap(route);
        lastSavedRouteId = route.id;
        updateStatus(`Загружено (ID: ${route.id})`);
        closeRoutesModal();
      });

      const shareBtn = document.createElement('button');
      shareBtn.textContent = 'Скопировать ссылку';
      shareBtn.style.margin = '0';
      shareBtn.addEventListener('click', async () => {
        const url = buildShareUrl(r.id);
        try {
          await navigator.clipboard.writeText(url);
          updateStatus('Ссылка скопирована');
        } catch (_) {
          updateStatus('Не удалось скопировать ссылку');
        }
      });

      actions.appendChild(loadBtn);
      actions.appendChild(shareBtn);

      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(actions);
      routesList.appendChild(item);
    });
  } catch (e) {
    console.error(e);
    routesListEmpty.style.display = 'block';
  }
}

// Поделиться ссылкой
async function handleShareRoute() {
  try {
    // Проверяем наличие точек
    if (!pointMarkers || pointMarkers.length === 0) {
      addApiLog('❌ Нет точек для обмена');
      alert('Сначала сгенерируйте точки на карте!');
      return;
    }
    
    // Получаем последовательность (уже готовую!)
    const { getCurrentSequence } = await import('./modules/routeSequence.js');
    const sequence = getCurrentSequence();
    
    if (!sequence || sequence.length === 0) {
      addApiLog('❌ Нет последовательности');
      alert('Последовательность маршрута еще не готова.\nПодождите завершения генерации маршрута.');
      return;
    }
    
    // Проверяем, что последовательность соответствует количеству точек
    if (sequence.length !== pointMarkers.length) {
      addApiLog('❌ Последовательность не соответствует точкам');
      alert('Последовательность маршрута еще не готова.\nПодождите завершения генерации маршрута.');
      return;
    }
    
    // Получаем стартовую точку
    const startPoint = getStartPoint();
    if (!startPoint) {
      addApiLog('❌ Не установлена точка старта');
      alert('Не установлена точка старта. Установите её на карте.');
      return;
    }
    
    // Получаем статистику маршрута для сохранения дистанции
    const { getRouteStats } = await import('./modules/routeSequence.js');
    const stats = getRouteStats();
    
    // Собираем данные точек с координатами (уже готовые!)
    const pointsData = pointMarkers.map((marker, idx) => {
      const latlng = marker.getLatLng();
      return {
        lat: latlng.lat,
        lng: latlng.lng,
        index: idx
      };
    });
    
    // Создаем объект данных для кодирования
    const shareData = {
      points: pointsData,
      sequence: sequence, // Готовая последовательность!
      startPoint: { lat: startPoint.lat, lng: startPoint.lng }, // Стартовая точка!
      distance: stats ? stats.totalDistance : 0, // Сохраняем дистанцию!
      timestamp: Date.now()
    };
    
    console.log('💾 Сохраняем shareData:', shareData);
    console.log('📏 Сохраняемая дистанция:', stats ? stats.totalDistance : 0, 'м');
    
    // Сначала пытаемся сохранить на сервере и получить короткую ссылку
    let finalUrl = '';
    try {
      const saveResponse = await fetch(`${BACKEND_SIMPLE_BASE}/save-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shareData)
      });
      
      if (saveResponse.ok) {
        const data = await saveResponse.json();
        if (data.url) {
          finalUrl = data.url;
          console.log('✅ Маршрут сохранен на сервере, короткая ссылка:', finalUrl);
          addApiLog('✅ Маршрут сохранен, короткая ссылка');
        }
      } else {
        console.warn('⚠️ Ошибка сохранения маршрута на сервере:', saveResponse.status);
        addApiLog('⚠️ Ошибка сохранения на сервере');
      }
    } catch (e) {
      console.error('❌ Ошибка при сохранении на сервере:', e);
      addApiLog('⚠️ Ошибка сохранения на сервере');
    }
    
    // Если не удалось сохранить на сервере, используем старый метод с кодированием в URL
    if (!finalUrl) {
      console.log('⚠️ Возвращаемся к старому методу с кодированием в URL');
      const jsonString = JSON.stringify(shareData);
      const encoded = btoa(unescape(encodeURIComponent(jsonString)));
      const baseUrl = window.location.origin + window.location.pathname;
      finalUrl = `${baseUrl}?share=${encoded}`;
      
      // Проверяем длину
      if (finalUrl.length > 2000) {
        addApiLog('❌ Слишком много точек для обмена через URL');
        alert('Слишком много точек для обмена через URL.\nРекомендуется до 30-40 точек.');
        return;
      }
    }
    
    // Копируем ссылку (короткую или полную)
    await navigator.clipboard.writeText(finalUrl);
    console.log('📋 Итоговая ссылка скопирована:', finalUrl);
    
    // Определяем тип ссылки для сообщения
    const isShortUrl = finalUrl.includes('/r/') && finalUrl.length < 100;
    const alertMessage = isShortUrl
      ? '✅ Короткая ссылка скопирована!\n\nОтправьте её другу, и он сразу увидит все точки и последовательность маршрута.'
      : '✅ Ссылка скопирована (использована полная версия)\n\nОтправьте её другу, и он сразу увидит все точки и последовательность маршрута.';
    alert(alertMessage);
  } catch (e) {
    console.error('Ошибка при подготовке ссылки:', e);
    addApiLog('❌ Ошибка при подготовке ссылки');
    alert('Ошибка при подготовке ссылки. Попробуйте еще раз.');
  }
}

// Отрисовать маршрут на карте по данным backend
function renderRouteOnMap(route) {
  try {
    // Восстанавливаем bounds
    if (route.bounds && typeof L !== 'undefined') {
      const b = route.bounds;
      const bounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);
      // очистить старый прямоугольник
      drawnItems.getLayers().forEach(l => { if (l instanceof L.Rectangle) drawnItems.removeLayer(l); });
      const rect = L.rectangle(bounds, { color: '#3388ff', weight: 2 });
      drawnItems.addLayer(rect);
      updateSelectedBounds(bounds);
      if (map) map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Восстанавливаем точку старта
    if (route.startPoint && typeof route.startPoint.lat === 'number' && typeof route.startPoint.lon === 'number') {
      updateStartPointPosition(route.startPoint.lat, route.startPoint.lon);
    }

    // Сбрасываем старую последовательность и завершенные точки
    resetSequence();
    resetCompletedPoints();

    // Восстанавливаем точки
    clearPointMarkers();
    if (Array.isArray(route.points)) {
      route.points.forEach((p, idx) => {
        if (typeof p.lat === 'number' && typeof p.lon === 'number') {
          const marker = L.marker([p.lat, p.lon], {
            icon: L.divIcon({
              className: 'custom-marker',
              html: `<div style="background: green; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white;">${idx + 1}</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15]
            })
          }).addTo(map);
          pointMarkers.push(marker);
        }
      });
      
      // Генерируем оптимальную последовательность для загруженного маршрута
      setTimeout(() => {
        generateAndDisplaySequence();
        updateTargetPointsList(); // Обновляем список точек
      }, 500);
    }
  } catch (e) {
    console.error('Ошибка отрисовки маршрута:', e);
  }
}

// Извлекает route_id из любой ссылки вида .../r/<id> или ?routeId=<id>
function extractRouteIdFromUrl(urlString) {
  if (!urlString) return null;
  // /r/<id>
  const m = urlString.match(/\/r\/([a-f0-9]{6,})/i);
  if (m) return m[1];
  // ?routeId=<id> или ?route=<id>
  try {
    const u = new URL(urlString);
    return u.searchParams.get('routeId') || u.searchParams.get('route');
  } catch {
    return null;
  }
}

// Загружает маршрут по короткому ID и рендерит его
async function loadShortRoute(routeId) {
  console.log('🔗 Загружаем маршрут по ID:', routeId);
  try {
    const response = await fetch(`${BACKEND_SIMPLE_BASE}/r/${routeId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.points && Array.isArray(data.points) && data.sequence && Array.isArray(data.sequence)) {
        await restoreRouteFromShareData(data);
        return true;
      }
    } else {
      addApiLog('❌ Маршрут не найден');
      alert('Маршрут не найден или срок действия ссылки истёк.');
    }
  } catch (e) {
    console.error('Ошибка загрузки маршрута:', e);
    addApiLog('❌ Ошибка загрузки маршрута');
    alert('Ошибка загрузки маршрута из ссылки.');
  }
  return false;
}

// Слушаем deep links из Android (MainActivity → Intent VIEW)
window.addEventListener('trailspotDeepLink', async (e) => {
  const url = e.detail || window.__trailspotDeepLink;
  const id = extractRouteIdFromUrl(url);
  if (id) await loadShortRoute(id);
});

// Глобальный хелпер: window.openRoute('https://trailspot.app/r/2d4ef14c')
// или window.openRoute('2d4ef14c') — для ручной загрузки маршрута
window.openRoute = async (urlOrId) => {
  const id = extractRouteIdFromUrl(urlOrId) || String(urlOrId).trim();
  if (!/^[a-f0-9]{6,}$/i.test(id)) {
    alert('Неверный ID маршрута. Ожидался hex-ID или ссылка вида trailspot.app/r/<id>');
    return false;
  }
  return await loadShortRoute(id);
};

// Автозагрузка из URL
async function bootstrapFromUrl() {
  try {
    // Android deep link: URL передан из MainActivity при старте
    if (window.__trailspotDeepLink) {
      const id = extractRouteIdFromUrl(window.__trailspotDeepLink);
      if (id && await loadShortRoute(id)) return;
    }

    // Проверяем короткие ссылки типа /r/route_id
    const pathMatch = window.location.pathname.match(/^\/r\/([a-f0-9]{8})$/);
    if (pathMatch) {
      const routeId = pathMatch[1];
      console.log('🔗 Загружаем маршрут из короткой ссылки:', routeId);
      
      try {
        const response = await fetch(`${BACKEND_SIMPLE_BASE}/r/${routeId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.points && Array.isArray(data.points) && data.sequence && Array.isArray(data.sequence)) {
            await restoreRouteFromShareData(data);
            return;
          }
        } else {
          addApiLog('❌ Маршрут не найден');
          alert('Маршрут не найден или срок действия ссылки истек.');
        }
      } catch (e) {
        console.error('Ошибка загрузки маршрута:', e);
        addApiLog('❌ Ошибка загрузки маршрута');
        alert('Ошибка загрузки маршрута из ссылки.');
      }
    }
    
    // Проверяем старый формат с параметром share
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get('share');
    if (shareData) {
      try {
        // Декодируем данные
        const decoded = decodeURIComponent(escape(atob(shareData)));
        const data = JSON.parse(decoded);
        
        if (data.points && Array.isArray(data.points) && data.sequence && Array.isArray(data.sequence)) {
          // Восстанавливаем точки и последовательность БЕЗ генерации
          await restoreRouteFromShareData(data);
          return;
        }
      } catch (e) {
        console.error('Ошибка декодирования данных из ссылки:', e);
        addApiLog('❌ Не удалось восстановить маршрут из ссылки');
        alert('Не удалось восстановить маршрут из ссылки.\nПроверьте корректность ссылки.');
      }
    }
    
    // Старый формат с routeId (для обратной совместимости)
    const routeId = params.get('routeId');
    if (routeId) {
      const route = await getRouteById(routeId);
      if (route) {
        renderRouteOnMap(route);
        lastSavedRouteId = route.id;
        addApiLog(`Загружено из ссылки (ID: ${route.id})`);
      }
    }
  } catch (e) {
    console.error('Ошибка автозагрузки из URL:', e);
  }
}

// Восстановление маршрута из закодированных данных (БЕЗ генерации!)
async function restoreRouteFromShareData(data) {
  try {
    const { clearPointMarkers, updateStartPointPosition } = await import('./modules/mapModule.js');
    const { updateSequence, getRouteStats } = await import('./modules/routeSequence.js');
    const { updateSequenceDisplay } = await import('./modules/sequenceUI.js');
    const { showInfoPanel, updateInfoPanel, showInfoPanelReady } = await import('./modules/uiController.js');
    
    addApiLog('Восстановление маршрута из ссылки...');
    
    // Очищаем старые точки и сбрасываем завершенные точки навигации
    clearPointMarkers();
    resetCompletedPoints();
    
    // Восстанавливаем точки на карте (без генерации!)
    const restoredMarkers = [];
    for (const pointData of data.points) {
      const marker = L.marker([pointData.lat, pointData.lng], {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `<div style="background: green; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white;">${pointData.index + 1}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(map);
      pointMarkers.push(marker);
      restoredMarkers.push(marker);
    }
    
    // Устанавливаем стартовую точку из сохраненных данных
    if (data.startPoint && data.startPoint.lat && data.startPoint.lng) {
      updateStartPointPosition(data.startPoint.lat, data.startPoint.lng);
    } else if (restoredMarkers.length > 0) {
      // Если стартовая точка не сохранена, используем центр области как fallback
      const bounds = L.latLngBounds(restoredMarkers.map(m => m.getLatLng()));
      const center = bounds.getCenter();
      updateStartPointPosition(center.lat, center.lng);
    }
    
    // Восстанавливаем готовую последовательность (без пересчета!)
    updateSequence(data.sequence);
    
    // Вычисляем границы для позиционирования карты
    if (restoredMarkers.length > 0) {
      const bounds = L.latLngBounds(
        restoredMarkers.map(m => m.getLatLng())
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Обновляем отображение БЕЗ генерации - просто показываем готовые данные
    setTimeout(async () => {
      console.log('📥 Восстановление данных из share:', data);
      console.log('📏 Дистанция в данных:', data.distance, 'м');
      
      // Скрываем подсказку и устанавливаем правильный шаг
      const { hideHint, setStep, setRestoredFromShare } = await import('./modules/uiController.js');
      hideHint();
      setStep('points_generated');
      setRestoredFromShare(true); // Отключаем кнопку обновления
      
      // Используем сохраненную дистанцию, если она есть
      let distanceKm = 0;
      if (data.distance && data.distance > 0) {
        // Используем сохраненную дистанцию (с учетом графа троп)
        distanceKm = data.distance / 1000;
        console.log('✅ Используем сохраненную дистанцию:', distanceKm, 'км (было', data.distance, 'м)');
      } else {
        // Fallback: рассчитываем дистанцию на лету
        console.log('⚠️ Сохраненная дистанция отсутствует, рассчитываем заново');
        const stats = getRouteStats();
        if (stats) {
          distanceKm = stats.totalDistance / 1000;
          console.log('📏 Рассчитанная дистанция:', distanceKm, 'км');
        }
      }
      
      // Формируем текст последовательности из готовых данных
      const sequenceText = data.sequence.map(idx => idx + 1).join(' → ');
      
      // Обновляем панель с готовыми данными (БЕЗ вызова updateSequenceDisplay!)
      updateInfoPanel(
        restoredMarkers.length,
        `СТАРТ → ${sequenceText} → СТАРТ`,
        distanceKm
      );
      
      // Показываем панель в состоянии "готово" с кнопкой "Начать навигацию"
      showInfoPanelReady();
      
      // Обновляем список точек для навигации
      updateTargetPointsList();
      
      addApiLog(`✅ Маршрут восстановлен (${restoredMarkers.length} точек)`);
    }, 300);
    
  } catch (e) {
    console.error('Ошибка восстановления маршрута:', e);
    addApiLog('❌ Ошибка восстановления маршрута');
    alert('Ошибка восстановления маршрута из ссылки.');
  }
}

// Функции для управления UI
function updateStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

function toggleGenerateButton(disabled) {
  if (generateBtn) {
    generateBtn.disabled = disabled;
  }
}

function toggleCancelButton(show) {
  if (cancelBtn) {
    cancelBtn.style.display = show ? 'inline-block' : 'none';
  }
}

// Функция для обновления глобальных переменных
function updateGlobalVars() {
  window.pointMarkers = pointMarkers;
  window.startPoint = getStartPoint();
}

// Автоматическая инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', initApp); 