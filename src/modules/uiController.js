/**
 * Модуль управления UI
 * Управляет новым мобильным интерфейсом
 */

// DOM элементы
let drawAreaBtn, hintSticker, clearAreaBtn, infoPanel, apiLogs;
let menuBtn, menuModal, menuClose, settingsBtn, settingsModal, settingsClose;
let shareBtn, zoomInBtn, zoomOutBtn, gpsBtn;
let saveGpxMenuItem, loadGpxMenuItem, savedRoutesMenuItem, gpxFileInput;
let infoPanelPoints, sequenceLink, sequenceDistance, startNavBtn, refreshBtn, deleteBtn;

// Состояние UI
let currentStep = 'select_area'; // select_area, place_start, points_generated, navigating
let isAreaSelected = false;
let isStartPlaced = false;

/**
 * Инициализация UI контроллера
 */
export function initUI() {
  console.log('🎨 Инициализация UI контроллера...');
  
  // Получаем DOM элементы
  drawAreaBtn = document.getElementById('drawAreaBtn');
  hintSticker = document.getElementById('hintSticker');
  clearAreaBtn = document.getElementById('clearAreaBtn');
  infoPanel = document.getElementById('infoPanel');
  apiLogs = document.getElementById('apiLogs');
  
  menuBtn = document.getElementById('menuBtn');
  menuModal = document.getElementById('menuModal');
  menuClose = document.getElementById('menuClose');
  
  settingsBtn = document.getElementById('settingsBtn');
  settingsModal = document.getElementById('settingsModal');
  settingsClose = document.getElementById('settingsClose');
  
  shareBtn = document.getElementById('shareBtn');
  zoomInBtn = document.getElementById('zoomInBtn');
  zoomOutBtn = document.getElementById('zoomOutBtn');
  gpsBtn = document.getElementById('gpsBtn');
  
  saveGpxMenuItem = document.getElementById('saveGpxMenuItem');
  loadGpxMenuItem = document.getElementById('loadGpxMenuItem');
  savedRoutesMenuItem = document.getElementById('savedRoutesMenuItem');
  gpxFileInput = document.getElementById('gpxFileInput');
  
  infoPanelPoints = document.getElementById('infoPanelPoints');
  sequenceLink = document.getElementById('sequenceLink');
  sequenceDistance = document.getElementById('sequenceDistance');
  startNavBtn = document.getElementById('startNavBtn');
  refreshBtn = document.getElementById('refreshBtn');
  deleteBtn = document.getElementById('deleteBtn');
  
  // Настраиваем обработчики
  setupEventHandlers();
  
  // Устанавливаем начальное состояние
  setStep('select_area');
  
  console.log('✅ UI контроллер инициализирован');
}

/**
 * Настройка обработчиков событий
 */
function setupEventHandlers() {
  // Меню
  menuBtn.addEventListener('click', () => menuModal.classList.add('show'));
  menuClose.addEventListener('click', () => menuModal.classList.remove('show'));
  menuModal.addEventListener('click', (e) => {
    if (e.target === menuModal) menuModal.classList.remove('show');
  });
  
  // Кнопка выбора области
  drawAreaBtn.addEventListener('click', () => {
    console.log('🎯 Активация режима выбора области');
    // Импортируем mapModule для доступа к drawControl
    import('./mapModule.js').then(module => {
      if (module.drawControl && module.drawControl._toolbars && module.drawControl._toolbars.draw) {
        const rectangleButton = module.drawControl._toolbars.draw._modes.rectangle;
        if (rectangleButton && rectangleButton.handler) {
          rectangleButton.handler.enable();
          addApiLog('🎯 Режим выбора области активирован. Нарисуйте прямоугольник на карте.');
        }
      }
    });
  });
  
  // Кнопка очистки области
  clearAreaBtn.addEventListener('click', () => {
    console.log('🗑️ Очистка выбранной области');
    import('./mapModule.js').then(module => {
      module.clearAll();
      addApiLog('🗑️ Область очищена');
    });
  });
  
  // Кнопки в info-panel
  refreshBtn.addEventListener('click', () => {
    console.log('🔄 Перегенерация точек');
    import('./mapModule.js').then(module => {
      module.triggerPointGeneration();
      addApiLog('🔄 Перегенерация точек...');
    });
  });
  
  deleteBtn.addEventListener('click', () => {
    console.log('🗑️ Удаление всех данных');
    import('./mapModule.js').then(module => {
      module.clearAll();
      addApiLog('🗑️ Все данные удалены');
    });
  });
  
  startNavBtn.addEventListener('click', () => {
    console.log('🎧 Запуск навигации');
    addApiLog('🎧 Запуск навигации...');
    // Здесь будет логика запуска навигации
  });
  
  // Кнопки зума и GPS
  zoomInBtn.addEventListener('click', () => {
    import('./mapModule.js').then(module => {
      if (module.map) {
        module.map.zoomIn();
        addApiLog('🔍 Приближение');
      }
    });
  });
  
  zoomOutBtn.addEventListener('click', () => {
    import('./mapModule.js').then(module => {
      if (module.map) {
        module.map.zoomOut();
        addApiLog('🔍 Отдаление');
      }
    });
  });
  
  gpsBtn.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      addApiLog('📍 Определение позиции...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          import('./mapModule.js').then(module => {
            if (module.map) {
              module.map.setView([latitude, longitude], 16);
              addApiLog(`📍 Позиция: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            }
          });
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
  
  // Настройки
  settingsBtn.addEventListener('click', () => settingsModal.classList.add('show'));
  settingsClose.addEventListener('click', () => settingsModal.classList.remove('show'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('show');
  });
  
  // Пункты меню
  saveGpxMenuItem.addEventListener('click', handleSaveGPX);
  loadGpxMenuItem.addEventListener('click', () => {
    menuModal.classList.remove('show');
    gpxFileInput.click();
  });
  savedRoutesMenuItem.addEventListener('click', handleShowSavedRoutes);
  
  // GPX файл input
  gpxFileInput.addEventListener('change', handleLoadGPX);
  
  // Кнопка очистки области
  clearAreaBtn.addEventListener('click', handleClearArea);
  
  // Кнопки информационной панели
  if (refreshBtn) refreshBtn.addEventListener('click', handleRefresh);
  if (deleteBtn) deleteBtn.addEventListener('click', handleDelete);
}

/**
 * Установка текущего шага
 */
export function setStep(step) {
  currentStep = step;
  
  switch(step) {
    case 'select_area':
      showHint('Укажите область для тренировки');
      drawAreaBtn.classList.add('active');
      hideInfoPanel();
      hideClearButton();
      break;
      
    case 'area_selected':
      showHint('Кликните на карте для установки точки старта');
      showClearButton();
      isAreaSelected = true;
      break;
      
    case 'start_placed':
      hideHint();
      isStartPlaced = true;
      // Автоматически начнется генерация
      break;
      
    case 'points_generated':
      hideHint();
      drawAreaBtn.classList.remove('active');
      showInfoPanel();
      break;
      
    case 'navigating':
      // Переход в режим навигации
      hideInfoPanel();
      break;
  }
}

/**
 * Показать подсказку
 */
export function showHint(text) {
  hintSticker.textContent = text;
  hintSticker.classList.add('show');
}

/**
 * Скрыть подсказку
 */
export function hideHint() {
  hintSticker.classList.remove('show');
}

/**
 * Показать кнопку очистки области
 */
export function showClearButton() {
  if (clearAreaBtn) {
    clearAreaBtn.style.display = 'flex';
  }
}

/**
 * Скрыть кнопку очистки области
 */
export function hideClearButton() {
  if (clearAreaBtn) {
    clearAreaBtn.style.display = 'none';
  }
}

/**
 * Позиционировать кнопку очистки в правом верхнем углу области
 */
export function positionClearButton(bounds, map) {
  if (!clearAreaBtn || !bounds || !map) return;
  
  try {
    const northEast = bounds.getNorthEast();
    const point = map.latLngToContainerPoint(northEast);
    
    clearAreaBtn.style.left = (point.x + 5) + 'px';
    clearAreaBtn.style.top = (point.y - 35) + 'px';
    clearAreaBtn.style.display = 'flex';
  } catch (e) {
    console.error('Ошибка позиционирования кнопки очистки:', e);
  }
}

/**
 * Показать информационную панель
 */
export function showInfoPanel() {
  if (infoPanel) {
    infoPanel.classList.add('show');
  }
}

/**
 * Скрыть информационную панель
 */
export function hideInfoPanel() {
  if (infoPanel) {
    infoPanel.classList.remove('show');
  }
}

/**
 * Обновить информацию в панели
 */
export function updateInfoPanel(pointsCount, sequenceText, distance) {
  if (infoPanelPoints) {
    infoPanelPoints.textContent = `Точек: ${pointsCount}`;
  }
  
  if (sequenceLink && sequenceText) {
    sequenceLink.textContent = sequenceText;
  }
  
  if (sequenceDistance && distance !== undefined) {
    sequenceDistance.textContent = `Дистанция: ${distance.toFixed(2)} км`;
  }
}

/**
 * Добавить лог API
 */
export function addApiLog(message) {
  if (!apiLogs) return;
  
  const logEntry = document.createElement('div');
  logEntry.className = 'api-log-entry';
  logEntry.textContent = message;
  
  apiLogs.appendChild(logEntry);
  
  // Автоматически удаляем старые логи (оставляем последние 10)
  while (apiLogs.children.length > 10) {
    apiLogs.removeChild(apiLogs.firstChild);
  }
  
  // Прокручиваем вниз
  apiLogs.scrollTop = apiLogs.scrollHeight;
}

/**
 * Очистить логи API
 */
export function clearApiLogs() {
  if (apiLogs) {
    apiLogs.innerHTML = '';
  }
}

/**
 * Обработчик сохранения GPX
 */
function handleSaveGPX() {
  menuModal.classList.remove('show');
  // Импортируем функцию из pointGeneration
  import('./pointGeneration.js').then(module => {
    module.downloadGPX();
  });
}

/**
 * Обработчик загрузки GPX
 */
function handleLoadGPX(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  addApiLog('Загрузка GPX файла...');
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const gpxContent = e.target.result;
      // TODO: Реализовать парсинг GPX
      addApiLog('GPX файл загружен');
      console.log('GPX Content:', gpxContent);
    } catch (error) {
      addApiLog('Ошибка загрузки GPX');
      console.error('GPX Load Error:', error);
    }
  };
  reader.readAsText(file);
  
  // Сбрасываем input для возможности повторной загрузки того же файла
  event.target.value = '';
}

/**
 * Обработчик показа сохраненных маршрутов
 */
function handleShowSavedRoutes() {
  menuModal.classList.remove('show');
  const routesModal = document.getElementById('routesModal');
  if (routesModal) {
    routesModal.style.display = 'flex';
  }
}

/**
 * Обработчик очистки области
 */
function handleClearArea() {
  if (confirm('Очистить всё и начать заново?')) {
    // Импортируем функцию очистки
    import('./mapModule.js').then(module => {
      module.clearAll();
      setStep('select_area');
      isAreaSelected = false;
      isStartPlaced = false;
    });
  }
}

/**
 * Обработчик обновления (регенерация точек)
 */
function handleRefresh() {
  addApiLog('Регенерация точек...');
  // Импортируем и вызываем генерацию
  import('./pointGeneration.js').then(module => {
    // Получаем текущее количество точек
    const pointsInput = document.getElementById('pointsCount');
    const count = pointsInput ? parseInt(pointsInput.value) : 10;
    
    import('./mapModule.js').then(mapModule => {
      const selectedBounds = mapModule.getSelectedBounds();
      const startPoint = mapModule.getStartPoint();
      
      if (selectedBounds && startPoint) {
        module.regeneratePoints(selectedBounds, startPoint, count);
      }
    });
  });
}

/**
 * Обработчик удаления (очистка всего)
 */
function handleDelete() {
  handleClearArea();
}

/**
 * Получить текущий шаг
 */
export function getCurrentStep() {
  return currentStep;
}

/**
 * Проверить, выбрана ли область
 */
export function isAreaDrawn() {
  return isAreaSelected;
}

/**
 * Проверить, установлена ли точка старта
 */
export function isStartSet() {
  return isStartPlaced;
}

