/**
 * Главный модуль приложения
 * Инициализирует все компоненты и связывает их между собой
 */

import { initMap, map, drawnItems, pointMarkers, getSelectedBounds, getStartPoint, updateSelectedBounds, updateStartPointPosition, clearPointMarkers } from './modules/mapModule.js';
import { initNavigation, updateTargetPointsList, resetCompletedPoints } from './modules/navigation.js';
import { generatePointsSimple as generatePoints, cancelPointGeneration } from './modules/pointGeneration_simple.js';
import { downloadGPX } from './modules/pointGeneration.js';
import './modules/audioModuleAdvanced.js'; // Инициализация продвинутого аудио модуля
import { saveRoute, getRouteById, getRoutesList, buildShareUrl } from './modules/storageAPI.js';
import { initSequenceUI, generateAndDisplaySequence } from './modules/sequenceUI.js';
import { resetSequence } from './modules/routeSequence.js';
import { initFullscreenNavigation } from './modules/fullscreenNavigation.js';
import { initMediaSession } from './modules/mediaSessionManager.js';

// DOM элементы (будут инициализированы в initApp)
let generateBtn, pointsInput, status, cancelBtn, downloadGpxBtn, saveRouteBtn, loadRouteBtn, shareRouteBtn;
let routesModal, routesModalClose, routesList, routesListEmpty;
let lastSavedRouteId = null;

// Инициализация приложения
export function initApp() {
  console.log('Инициализация приложения...');
  
  // Инициализируем DOM элементы
  generateBtn = document.getElementById('generateBtn');
  pointsInput = document.getElementById('pointsCount');
  status = document.getElementById('status');
  cancelBtn = document.getElementById('cancelBtn');
  downloadGpxBtn = document.getElementById('downloadGpxBtn');
  saveRouteBtn = document.getElementById('saveRouteBtn');
  loadRouteBtn = document.getElementById('loadRouteBtn');
  shareRouteBtn = document.getElementById('shareRouteBtn');
  routesModal = document.getElementById('routesModal');
  routesModalClose = document.getElementById('routesModalClose');
  routesList = document.getElementById('routesList');
  routesListEmpty = document.getElementById('routesListEmpty');
  
  // Проверяем наличие всех элементов
  if (!generateBtn || !pointsInput || !status || !cancelBtn || !downloadGpxBtn || !saveRouteBtn || !loadRouteBtn || !shareRouteBtn || !routesModal || !routesModalClose || !routesList || !routesListEmpty) {
    console.error('Не найдены необходимые DOM элементы');
    console.error('generateBtn:', !!generateBtn);
    console.error('pointsInput:', !!pointsInput);
    console.error('status:', !!status);
    console.error('cancelBtn:', !!cancelBtn);
    console.error('downloadGpxBtn:', !!downloadGpxBtn);
    console.error('saveRouteBtn:', !!saveRouteBtn);
    console.error('loadRouteBtn:', !!loadRouteBtn);
    console.error('shareRouteBtn:', !!shareRouteBtn);
    return;
  }
  
  // Инициализируем модули
  initMap();
  initNavigation();
  initSequenceUI();
  initFullscreenNavigation();
  initMediaSession();
  
  // Настраиваем обработчики событий
  setupEventHandlers();

  // Автозагрузка из URL (?routeId=...)
  bootstrapFromUrl();
  
  // Экспорт для глобального доступа (временно, для совместимости)
  updateGlobalVars();
  setInterval(updateGlobalVars, 1000); // Обновляем каждую секунду
  
  console.log('Приложение инициализировано');
}

// Настройка обработчиков событий
function setupEventHandlers() {
  // Обработчик кнопки генерации
  generateBtn.addEventListener('click', handleGenerateClick);
  
  // Обработчик кнопки отмены
  cancelBtn.addEventListener('click', handleCancelClick);
  
  // Обработчик кнопки скачивания GPX
  downloadGpxBtn.addEventListener('click', handleDownloadGPX);

  // Сохранение/загрузка/шаринг
  saveRouteBtn.addEventListener('click', handleSaveRoute);
  loadRouteBtn.addEventListener('click', openRoutesModal);
  shareRouteBtn.addEventListener('click', handleShareRoute);

  // Модалка
  routesModalClose.addEventListener('click', closeRoutesModal);
  routesModal.addEventListener('click', (e) => { if (e.target === routesModal) closeRoutesModal(); });
}

// Обработчик клика по кнопке генерации
async function handleGenerateClick() {
  const count = parseInt(pointsInput.value, 10);
  
  // Сбрасываем старую последовательность и завершенные точки
  resetSequence();
  resetCompletedPoints();
  
  // Получаем текущие значения из mapModule
  const selectedBounds = getSelectedBounds();
  const startPoint = getStartPoint();
  
  await generatePoints(
    selectedBounds,
    startPoint,
    count,
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
    let routeId = lastSavedRouteId;
    if (!routeId) {
      // Если ещё не сохранено — сохраним быстро без вопросов
      await handleSaveRoute();
      routeId = lastSavedRouteId;
    }
    if (!routeId) {
      updateStatus('Не удалось подготовить ссылку');
      return;
    }
    const url = buildShareUrl(routeId);
    await navigator.clipboard.writeText(url);
    updateStatus('Ссылка скопирована в буфер обмена');
    alert('Ссылка скопирована. Отправьте её другу.');
  } catch (e) {
    console.error(e);
    updateStatus('Ошибка при подготовке ссылки');
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

// Автозагрузка из URL
async function bootstrapFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const routeId = params.get('routeId');
    if (routeId) {
      const route = await getRouteById(routeId);
      if (route) {
        renderRouteOnMap(route);
        lastSavedRouteId = route.id;
        updateStatus(`Загружено из ссылки (ID: ${route.id})`);
      }
    }
  } catch (e) {
    console.error('Ошибка автозагрузки из URL:', e);
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