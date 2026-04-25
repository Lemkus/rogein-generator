/**
 * Модуль управления UI
 * Управляет новым мобильным интерфейсом
 */

console.log('🚀 uiController.js загружается...');

// DOM элементы
let drawAreaBtn, polygonBtn, hintSticker, clearAreaBtn, infoPanel, apiLogs;
let menuBtn, menuModal, menuClose, settingsBtn, settingsModal, settingsClose;
let shareBtn, zoomInBtn, zoomOutBtn, gpsBtn;
let saveGpxMenuItem, loadGpxMenuItem, savedRoutesMenuItem, gpxFileInput;
let infoPanelPoints, sequenceLink, sequenceDistance, startNavBtn, refreshBtn, deleteBtn;
let distanceValue, distanceDecreaseBtn, distanceIncreaseBtn;
let infoPanelGenerating, infoPanelError, infoPanelReady, infoPanelStatus, infoPanelErrorMessage;

// Состояние UI
let currentStep = 'select_area'; // select_area, place_start, points_generated, navigating
let isAreaSelected = false;
let isStartPlaced = false;
let isRestoredFromShare = false; // Флаг: восстановлен ли маршрут из shared-ссылки

// История удаленных точек для восстановления
let removedPointsHistory = []; // Массив объектов {index, coords: {lat, lng}}

// Индексы точек, добавленных через кнопку "+" (в порядке добавления)
let addedPointsIndices = []; // Массив индексов точек, добавленных через "+"

/**
 * Инициализация UI контроллера
 */
export function initUI() {
  console.log('🎨 Инициализация UI контроллера...');
  console.log('🔍 DOM готов?', document.readyState);
  
  // Получаем DOM элементы
  drawAreaBtn = document.getElementById('drawAreaBtn');
  polygonBtn = document.getElementById('polygonBtn');
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
  distanceValue = document.getElementById('distanceValue');
  distanceDecreaseBtn = document.getElementById('distanceDecreaseBtn');
  distanceIncreaseBtn = document.getElementById('distanceIncreaseBtn');
  
  // Элементы состояний infoPanel
  infoPanelGenerating = document.getElementById('infoPanelGenerating');
  infoPanelError = document.getElementById('infoPanelError');
  infoPanelReady = document.getElementById('infoPanelReady');
  infoPanelStatus = document.getElementById('infoPanelStatus');
  infoPanelErrorMessage = document.getElementById('infoPanelErrorMessage');
  
  // Отладка DOM элементов
  console.log('🔍 Проверка DOM элементов:');
  console.log('  drawAreaBtn:', drawAreaBtn);
  console.log('  polygonBtn:', polygonBtn);
  console.log('  startNavBtn:', startNavBtn);
  console.log('  refreshBtn:', refreshBtn);
  console.log('  deleteBtn:', deleteBtn);
  
  // Дополнительная проверка - поиск кнопки независимо от видимости родителя
  const startNavBtnDirect = document.getElementById('startNavBtn');
  console.log('🔍 Прямой поиск startNavBtn:', startNavBtnDirect);
  
  // Настраиваем обработчики
  setupEventHandlers();
  
  // Загружаем настройки из localStorage
  loadSettingsFromStorage();
  applyAudioSettings();
  
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
  
  // Кнопка выбора области (прямоугольник)
  drawAreaBtn.addEventListener('click', () => {
    console.log('🎯 Активация режима выбора области (прямоугольник)');
    
    // Скрываем подсказку при начале рисования
    hideHint();
    
    // Активируем кнопку прямоугольника и деактивируем полигон
    drawAreaBtn.classList.add('active');
    polygonBtn.classList.remove('active');
    
    // Импортируем mapModule для доступа к drawControl
    import('./mapModule.js').then(module => {
      if (module.drawControl && module.drawControl._toolbars && module.drawControl._toolbars.draw) {
        // Отключаем все активные handlers перед включением нового
        const polygonButton = module.drawControl._toolbars.draw._modes.polygon;
        if (polygonButton && polygonButton.handler && polygonButton.handler._enabled) {
          polygonButton.handler.disable();
        }
        
        const rectangleButton = module.drawControl._toolbars.draw._modes.rectangle;
        if (rectangleButton && rectangleButton.handler) {
          // Отключаем handler если он уже активен
          if (rectangleButton.handler._enabled) {
            rectangleButton.handler.disable();
          }
          rectangleButton.handler.enable();
          addApiLog('🎯 Режим выбора области активирован. Нарисуйте прямоугольник на карте.');
        }
      }
    });
  });
  
  // Функция переключения на полигон (вынесена для использования в click и touchstart)
  function switchToPolygon() {
    console.log('🎯 Активация режима выбора области (полигон)');
    
    // Скрываем подсказку при начале рисования
    hideHint();
    
    // Активируем кнопку полигона и деактивируем прямоугольник
    polygonBtn.classList.add('active');
    drawAreaBtn.classList.remove('active');
    
    // Импортируем mapModule для доступа к drawControl
    import('./mapModule.js').then(module => {
      if (module.drawControl && module.drawControl._toolbars && module.drawControl._toolbars.draw) {
        // Отключаем все активные handlers перед включением нового
        const rectangleButton = module.drawControl._toolbars.draw._modes.rectangle;
        if (rectangleButton && rectangleButton.handler) {
          // Всегда отключаем, даже если handler в промежуточном состоянии
          rectangleButton.handler.disable();
        }
        
        const polygonButton = module.drawControl._toolbars.draw._modes.polygon;
        if (polygonButton && polygonButton.handler) {
          // Отключаем handler если он уже активен
          if (polygonButton.handler._enabled) {
            polygonButton.handler.disable();
          }
          polygonButton.handler.enable();
          addApiLog('🎯 Режим выбора области активирован. Нарисуйте многоугольник на карте.');
        }
      }
    });
  }
  
  // Кнопка выбора области (полигон) - используем и click и touchstart для мобильных
  polygonBtn.addEventListener('click', switchToPolygon);
  polygonBtn.addEventListener('touchstart', async (e) => {
    e.stopPropagation(); // Останавливаем распространение, чтобы handler прямоугольника не перехватил
    e.preventDefault(); // Предотвращаем стандартное поведение
    
    // Синхронно отключаем handler прямоугольника ДО асинхронного кода
    const mapModule = await import('./mapModule.js');
    if (mapModule.disableRectangleHandlerSync) {
      mapModule.disableRectangleHandlerSync();
    }
    
    switchToPolygon();
  }, { passive: false });
  
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
  
  // Используем прямой поиск кнопки - КРИТИЧНО для навигации
  const navBtn = document.getElementById('startNavBtn');
  console.log('🔍 Поиск кнопки startNavBtn:', navBtn);
  if (navBtn) {
    // КРИТИЧНО: Убираем disabled, если он был добавлен
    navBtn.disabled = false;
    navBtn.removeAttribute('disabled');
    
    const clickHandler = () => {
      console.log('🎧🎧🎧 КНОПКА НАВИГАЦИИ НАЖАТА!!!');
      addApiLog('🎧 Запуск навигации...');
      
      // Импортируем и запускаем навигацию
      import('./navigation.js').then(nav => {
        console.log('📦 Модуль navigation.js загружен');
        nav.startNavigation();
        addApiLog('✅ Навигация запущена');
      }).catch(err => {
        console.error('❌ Ошибка загрузки модуля navigation.js:', err);
        addApiLog('❌ Ошибка запуска навигации');
      });
    };
    
    navBtn.addEventListener('click', clickHandler);
    console.log('✅ Обработчик startNavBtn добавлен');
    console.log('   Элемент:', navBtn);
    console.log('   ID:', navBtn.id);
    console.log('   disabled:', navBtn.disabled);
  } else {
    console.error('❌ startNavBtn не найден в DOM!');
  }
  
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
  settingsBtn.addEventListener('click', () => {
    loadSettingsFromStorage();
    settingsModal.classList.add('show');
  });
  settingsClose.addEventListener('click', () => settingsModal.classList.remove('show'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('show');
  });
  
  // Обработчик настройки "Бегаю с музыкой"
  const runningWithMusicCheckbox = document.getElementById('runningWithMusic');
  if (runningWithMusicCheckbox) {
    runningWithMusicCheckbox.addEventListener('change', handleRunningWithMusicChange);
  }
  
  // Пункты меню
  saveGpxMenuItem.addEventListener('click', handleSaveGPX);
  loadGpxMenuItem.addEventListener('click', () => {
    menuModal.classList.remove('show');
    gpxFileInput.click();
  });
  savedRoutesMenuItem.addEventListener('click', handleShowSavedRoutes);

  const openLinkMenuItem = document.getElementById('openLinkMenuItem');
  if (openLinkMenuItem) {
    openLinkMenuItem.addEventListener('click', async () => {
      menuModal.classList.remove('show');
      const input = prompt(
        'Вставьте ссылку или ID маршрута:\n' +
        '(например, https://trailspot.app/r/2d4ef14c или 2d4ef14c)'
      );
      if (input && window.openRoute) {
        await window.openRoute(input);
      }
    });
  }
  
  // GPX файл input
  gpxFileInput.addEventListener('change', handleLoadGPX);
  
  // Кнопка очистки области
  clearAreaBtn.addEventListener('click', handleClearArea);
  
  // Кнопки информационной панели
  if (refreshBtn) refreshBtn.addEventListener('click', handleRefresh);
  if (deleteBtn) deleteBtn.addEventListener('click', handleDelete);
  
  // Обработчики кнопок управления дистанцией
  if (distanceDecreaseBtn) {
    distanceDecreaseBtn.addEventListener('click', handleDistanceDecrease);
  }
  
  if (distanceIncreaseBtn) {
    distanceIncreaseBtn.addEventListener('click', handleDistanceIncrease);
  }
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
      polygonBtn.classList.remove('active');
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
      polygonBtn.classList.remove('active');
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
    
    // Проверяем, что точка находится в видимой области карты
    const mapSize = map.getSize();
    if (point.x >= 0 && point.x <= mapSize.x && point.y >= 0 && point.y <= mapSize.y) {
      clearAreaBtn.style.left = (point.x + 5) + 'px';
      clearAreaBtn.style.top = (point.y - 35) + 'px';
      clearAreaBtn.style.display = 'flex';
    } else {
      // Если область не видна, скрываем кнопку
      clearAreaBtn.style.display = 'none';
    }
  } catch (e) {
    console.error('Ошибка позиционирования кнопки очистки:', e);
    clearAreaBtn.style.display = 'none';
  }
}

/**
 * Показать информационную панель
 */
export function showInfoPanel() {
  console.log('🎯 showInfoPanel вызвана');
  console.log('  infoPanel:', infoPanel);
  if (infoPanel) {
    infoPanel.classList.add('show');
    console.log('  ✅ Класс show добавлен к infoPanel');
    console.log('  Текущие классы:', infoPanel.className);
    console.log('  Текущий display:', window.getComputedStyle(infoPanel).display);
    
    // КРИТИЧНО: Убираем disabled с кнопки навигации
    const navBtn = document.getElementById('startNavBtn');
    if (navBtn) {
      navBtn.disabled = false;
      navBtn.removeAttribute('disabled');
      console.log('  ✅ Кнопка навигации разблокирована');
    }
  } else {
    console.error('  ❌ infoPanel не найден!');
  }
}

/**
 * Показать состояние "формирование точек"
 */
export function showInfoPanelGenerating(message = 'Загрузка данных...') {
  if (infoPanel) {
    infoPanel.classList.add('show');
    
    // Скрываем все состояния
    if (infoPanelError) infoPanelError.style.display = 'none';
    if (infoPanelReady) infoPanelReady.style.display = 'none';
    
    // Показываем состояние формирования
    if (infoPanelGenerating) {
      infoPanelGenerating.style.display = 'block';
    }
    if (infoPanelStatus) {
      infoPanelStatus.textContent = message;
    }
  }
}

/**
 * Показать состояние "ошибка"
 */
export function showInfoPanelError(message = 'Не удалось загрузить данные. Попробуйте еще раз.') {
  if (infoPanel) {
    infoPanel.classList.add('show');
    
    // Скрываем все состояния
    if (infoPanelGenerating) infoPanelGenerating.style.display = 'none';
    if (infoPanelReady) infoPanelReady.style.display = 'none';
    
    // Показываем состояние ошибки
    if (infoPanelError) {
      infoPanelError.style.display = 'block';
    }
    if (infoPanelErrorMessage) {
      infoPanelErrorMessage.textContent = message;
    }
  }
}

/**
 * Показать состояние "готово"
 */
export function showInfoPanelReady() {
  console.log('🎯 showInfoPanelReady вызвана');
  console.log('  infoPanel:', infoPanel);
  if (infoPanel) {
    infoPanel.classList.add('show');
    console.log('  ✅ Класс show добавлен');
    console.log('  Текущие классы:', infoPanel.className);
    console.log('  Computed display:', window.getComputedStyle(infoPanel).display);
    console.log('  Computed visibility:', window.getComputedStyle(infoPanel).visibility);
    console.log('  Computed bottom:', window.getComputedStyle(infoPanel).bottom);
    console.log('  Computed z-index:', window.getComputedStyle(infoPanel).zIndex);
    
    // Скрываем все состояния
    if (infoPanelGenerating) infoPanelGenerating.style.display = 'none';
    if (infoPanelError) infoPanelError.style.display = 'none';
    
    // Показываем состояние готово
    if (infoPanelReady) {
      infoPanelReady.style.display = 'block';
      console.log('  ✅ infoPanelReady показан');
    }
    
    // КРИТИЧНО: Убираем disabled с кнопки навигации
    const navBtn = document.getElementById('startNavBtn');
    if (navBtn) {
      navBtn.disabled = false;
      navBtn.removeAttribute('disabled');
    }
    
    // На мобильных устройствах: принудительно устанавливаем позицию с учетом реального viewport
    // Это решает проблему, когда панель уходит за пределы экрана из-за особенностей viewport
    if (window.innerWidth <= 768) {
      // Используем несколько попыток с разными задержками для надежности
      const fixPosition = () => {
        if (!infoPanel) return;
        
        // Получаем реальную видимую высоту экрана
        const visualViewport = window.visualViewport || window;
        const viewportHeight = visualViewport.height || window.innerHeight || document.documentElement.clientHeight;
        
        // Принудительно устанавливаем позицию относительно видимой области
        infoPanel.style.position = 'fixed';
        infoPanel.style.bottom = '0';
        infoPanel.style.left = '10px';
        infoPanel.style.right = '10px';
        infoPanel.style.top = 'auto';
        infoPanel.style.transform = 'translateY(0)';
        
        // Ограничиваем высоту панели, чтобы она точно помещалась на экране
        const maxHeight = Math.min(viewportHeight * 0.8, 400);
        infoPanel.style.maxHeight = `${maxHeight}px`;
        
        // Проверяем позицию после небольшой задержки
        setTimeout(() => {
          if (!infoPanel) return;
          const rect = infoPanel.getBoundingClientRect();
          const visibleBottom = visualViewport.height || window.innerHeight;
          
          // Если панель все еще выходит за пределы, корректируем
          if (rect.bottom > visibleBottom || rect.top < 0) {
            const offset = Math.max(0, rect.bottom - visibleBottom);
            if (offset > 0) {
              infoPanel.style.bottom = `${offset}px`;
            }
            // Дополнительно ограничиваем высоту
            const newMaxHeight = Math.min(visibleBottom - rect.top - 10, maxHeight);
            infoPanel.style.maxHeight = `${newMaxHeight}px`;
          }
        }, 50);
      };
      
      // Вызываем сразу и с задержками для надежности
      fixPosition();
      setTimeout(fixPosition, 100);
      setTimeout(fixPosition, 300);
      setTimeout(fixPosition, 500);
      
      // Также слушаем изменения viewport (например, когда скрывается адресная строка)
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', fixPosition);
        window.visualViewport.addEventListener('scroll', fixPosition);
      }
    }
  } else {
    console.error('  ❌ infoPanel не найден!');
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
  // Убеждаемся что панель видна
  if (infoPanel) {
    infoPanel.classList.add('show');
  }
  
  if (infoPanelPoints) {
    infoPanelPoints.textContent = `Точек: ${pointsCount}`;
  }
  
  if (sequenceLink && sequenceText) {
    sequenceLink.textContent = sequenceText;
  }
  
  if (distanceValue && distance !== undefined) {
    const distanceVal = typeof distance === 'number' ? distance : parseFloat(distance) || 0;
    distanceValue.textContent = `${distanceVal.toFixed(2)} км`;
  }
  
  // Обновляем состояние кнопок управления дистанцией
  updateDistanceButtonsState();
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
    // Очищаем историю удаленных точек и список добавленных точек
    removedPointsHistory = [];
    addedPointsIndices = [];
    
    // Импортируем функцию очистки
    import('./mapModule.js').then(module => {
      module.clearAll();
      setStep('select_area');
      isAreaSelected = false;
      isStartPlaced = false;
      setRestoredFromShare(false); // Разблокируем кнопку обновления
    });
  }
}

/**
 * Обработчик обновления (регенерация точек)
 */
function handleRefresh() {
  // Если маршрут восстановлен из shared-ссылки, ничего не делаем
  if (isRestoredFromShare) {
    addApiLog('⚠️ Обновление недоступно для маршрута из ссылки');
    return;
  }
  
  addApiLog('Регенерация точек...');
  
  // Получаем текущее количество точек
  const pointsInput = document.getElementById('pointsCount');
  const count = pointsInput ? parseInt(pointsInput.value) : 10;
  
  // Получаем уровень сложности
  const difficultyLevelSelect = document.getElementById('difficultyLevel');
  const difficultyLevel = difficultyLevelSelect ? parseInt(difficultyLevelSelect.value) : 2;
  
  // Импортируем и вызываем генерацию
  import('./pointGeneration.js').then(module => {
    import('./mapModule.js').then(mapModule => {
      const selectedBounds = mapModule.getSelectedBounds();
      const startPoint = mapModule.getStartPoint();
      
      if (selectedBounds && startPoint) {
        // Сбрасываем флаг после ручной генерации
        isRestoredFromShare = false;
        
        module.generatePoints(
          selectedBounds,
          startPoint,
          count,
          difficultyLevel,
          (message) => addApiLog(message),
          () => {}, // toggleGenerateButton
          () => {}  // toggleCancelButton
        );
      }
    });
  });
}

/**
 * Установить флаг восстановления из shared-ссылки
 */
export function setRestoredFromShare(value) {
  isRestoredFromShare = value;
  
  // Управляем видимостью кнопки refresh
  if (refreshBtn) {
    if (value) {
      refreshBtn.style.display = 'none'; // Скрываем кнопку
      addApiLog('ℹ️ Обновление недоступно для маршрута из ссылки');
    } else {
      refreshBtn.style.display = 'flex'; // Показываем кнопку
    }
  }
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

/**
 * Очистить поле дистанции
 */
export function clearDistanceField() {
    removedPointsHistory = []; // Очищаем историю при очистке области
    addedPointsIndices = []; // Очищаем список добавленных точек
}

/**
 * Обработчик кнопки уменьшения дистанции (удаление точки)
 */
async function handleDistanceDecrease() {
  const { getRouteStats, getTrailGraph, getCurrentSequence, resetSequence, generateOptimalSequence } = await import('./routeSequence.js');
  const { getStartPoint, pointMarkers, removePointMarker } = await import('./mapModule.js');
  const { findNearestNodeIdx } = await import('./algorithms.js');
  const { dijkstra } = await import('./algorithms.js');
  const { haversine } = await import('./utils.js');
  
  if (pointMarkers.length <= 3) {
    addApiLog('⚠️ Минимальное количество точек: 3');
    return;
  }
  
  let pointToRemoveIdx = -1;
  
  // Если есть точки, добавленные через "+", удаляем последнюю из них
  if (addedPointsIndices.length > 0) {
    // Берем последний индекс из списка добавленных точек
    const lastAddedIdx = addedPointsIndices[addedPointsIndices.length - 1];
    
    // Проверяем, что индекс валиден
    if (lastAddedIdx >= 0 && lastAddedIdx < pointMarkers.length) {
      pointToRemoveIdx = lastAddedIdx;
      // Удаляем индекс из списка добавленных точек
      addedPointsIndices.pop();
    } else {
      // Если индекс невалиден, очищаем список и используем алгоритм
      addedPointsIndices = [];
    }
  }
  
  // Если не нашли точку для удаления (нет добавленных через "+"), используем алгоритм наибольшего вклада
  if (pointToRemoveIdx === -1) {
    const stats = getRouteStats();
    if (!stats) {
      addApiLog('❌ Не удалось получить статистику маршрута');
    return;
  }
  
    const startPoint = getStartPoint();
    if (!startPoint) {
      addApiLog('❌ Стартовая точка не найдена');
      return;
    }
    
    const sequence = getCurrentSequence();
    if (!sequence || sequence.length === 0) {
      addApiLog('❌ Последовательность пуста');
      return;
    }
    
    const trailGraph = getTrailGraph();
    const calculatePathDistance = (from, to) => {
      if (!trailGraph || !trailGraph.nodes || trailGraph.nodes.length === 0) {
        return haversine(from.lat, from.lng, to.lat, to.lng);
      }
      const fromNodeIdx = findNearestNodeIdx(from.lat, from.lng, trailGraph.nodes);
      const toNodeIdx = findNearestNodeIdx(to.lat, to.lng, trailGraph.nodes);
      if (fromNodeIdx === -1 || toNodeIdx === -1) {
        return haversine(from.lat, from.lng, to.lat, to.lng);
      }
      const result = dijkstra(trailGraph, fromNodeIdx, toNodeIdx);
      if (result.distance < Infinity) {
        return result.distance;
      }
      return haversine(from.lat, from.lng, to.lat, to.lng) * 10;
    };
    
    // Вычисляем вклад каждой точки
    let maxContribution = 0;
    
    for (let i = 0; i < sequence.length; i++) {
      const pointIdx = sequence[i];
      const pointCoords = pointMarkers[pointIdx].getLatLng();
      const prevIdx = i > 0 ? sequence[i - 1] : -1;
      const nextIdx = i < sequence.length - 1 ? sequence[i + 1] : -1;
      
      let distToPrev, distToNext, directDist;
      
      if (prevIdx === -1) {
        distToPrev = calculatePathDistance(startPoint, pointCoords);
    } else {
        const prevCoords = pointMarkers[prevIdx].getLatLng();
        distToPrev = calculatePathDistance(prevCoords, pointCoords);
      }
      
      if (nextIdx === -1) {
        distToNext = calculatePathDistance(pointCoords, startPoint);
      } else {
        const nextCoords = pointMarkers[nextIdx].getLatLng();
        distToNext = calculatePathDistance(pointCoords, nextCoords);
      }
      
      if (prevIdx === -1 && nextIdx === -1) {
        directDist = 0;
      } else if (prevIdx === -1) {
        const nextCoords = pointMarkers[nextIdx].getLatLng();
        directDist = calculatePathDistance(startPoint, nextCoords);
      } else if (nextIdx === -1) {
        const prevCoords = pointMarkers[prevIdx].getLatLng();
        directDist = calculatePathDistance(prevCoords, startPoint);
      } else {
        const prevCoords = pointMarkers[prevIdx].getLatLng();
        const nextCoords = pointMarkers[nextIdx].getLatLng();
        directDist = calculatePathDistance(prevCoords, nextCoords);
      }
      
      const contribution = (distToPrev + distToNext) - directDist;
      
      if (contribution > maxContribution) {
        maxContribution = contribution;
        pointToRemoveIdx = pointIdx;
      }
    }
  }
  
  if (pointToRemoveIdx === -1) {
    addApiLog('⚠️ Не найдена точка для удаления');
    return;
  }
  
  // Сохраняем удаляемую точку в историю
  const pointCoords = pointMarkers[pointToRemoveIdx].getLatLng();
  removedPointsHistory.push({
    index: pointToRemoveIdx,
    coords: { lat: pointCoords.lat, lng: pointCoords.lng }
  });
  
  // Удаляем точку
  removePointMarker(pointToRemoveIdx);
  addApiLog(`🗑️ Удалена точка ${pointToRemoveIdx + 1}`);
  
  // Обновляем индексы в addedPointsIndices: уменьшаем на 1 все индексы, которые больше удаленного
  addedPointsIndices = addedPointsIndices.map(idx => {
    if (idx > pointToRemoveIdx) {
      return idx - 1;
    }
    return idx;
  }).filter(idx => idx >= 0 && idx < pointMarkers.length); // Удаляем невалидные индексы
  
  // Пересчитываем последовательность
  resetSequence();
  generateOptimalSequence();
  
  // Обновляем отображение
  const { updateSequenceDisplay } = await import('./sequenceUI.js');
  updateSequenceDisplay();
  
  // Обновляем состояние кнопок
  updateDistanceButtonsState();
}

/**
 * Обработчик кнопки увеличения дистанции (добавление/восстановление точки)
 */
async function handleDistanceIncrease() {
  const { pointMarkers, addPointMarker } = await import('./mapModule.js');
  const { getSelectedBounds } = await import('./mapModule.js');
  const { getTrailGraph } = await import('./routeSequence.js');
  const { findNearestNodeIdx } = await import('./algorithms.js');
  const { haversine } = await import('./utils.js');
  
  // Если есть удаленные точки, восстанавливаем последнюю
  if (removedPointsHistory.length > 0) {
    const lastRemoved = removedPointsHistory.pop();
    const newNumber = pointMarkers.length + 1;
    addPointMarker(lastRemoved.coords.lat, lastRemoved.coords.lng, newNumber);
    addApiLog(`✅ Восстановлена точка ${newNumber}`);
    
    // Пересчитываем последовательность
    const { resetSequence, generateOptimalSequence } = await import('./routeSequence.js');
    resetSequence();
    generateOptimalSequence();
    
    // Обновляем отображение
    const { updateSequenceDisplay } = await import('./sequenceUI.js');
    updateSequenceDisplay();
    
    // Обновляем состояние кнопок
    updateDistanceButtonsState();
    return;
  }
  
  // Добавляем новую точку как можно дальше от других
  await addPointFarthestFromOthers();
  
  // Обновляем состояние кнопок
  updateDistanceButtonsState();
}

/**
 * Добавить новую точку как можно дальше от других
 */
async function addPointFarthestFromOthers() {
  const { pointMarkers, getSelectedBounds, addPointMarker, getStartPoint } = await import('./mapModule.js');
  const { getTrailGraph } = await import('./routeSequence.js');
  const { haversine, pointInPolygon } = await import('./utils.js');
  const { getForbiddenPolygons } = await import('./pointGeneration.js');
  const { findNearestNodeIdx, isReachable } = await import('./algorithms.js');
  
  const selectedBounds = getSelectedBounds();
  const startPoint = getStartPoint();
  const trailGraph = getTrailGraph();
  const forbiddenPolygons = getForbiddenPolygons();
  
  if (!selectedBounds || !startPoint || !trailGraph || !trailGraph.nodes || trailGraph.nodes.length === 0) {
    addApiLog('❌ Недостаточно данных для добавления точки');
    return;
  }
  
  // Находим ближайший узел к стартовой точке для проверки достижимости
  const startNodeIdx = findNearestNodeIdx(startPoint.lat, startPoint.lng, trailGraph.nodes);
  if (startNodeIdx === -1) {
    addApiLog('❌ Не найден узел графа для стартовой точки');
    return;
  }
  
  // Собираем все существующие точки (включая старт)
  const allPoints = [startPoint, ...pointMarkers.map(m => m.getLatLng())];
  
  // Ищем узел графа, который максимально далеко от всех существующих точек
  let maxMinDistance = 0;
  let bestNodeIdx = -1;
  
  for (let i = 0; i < trailGraph.nodes.length; i++) {
    const node = trailGraph.nodes[i];
    const nodeCoords = { lat: node.lat, lng: node.lon };
    
    // Проверяем, что узел в выбранной области (bounding box)
    if (node.lat < selectedBounds.south || node.lat > selectedBounds.north ||
        node.lon < selectedBounds.west || node.lon > selectedBounds.east) {
                continue;
              }
    
    // Дополнительная проверка для полигона
    if (selectedBounds.type === 'polygon' && selectedBounds.polygon) {
      try {
        // Используем ту же логику, что и в pointGeneration.js
        const polygonLatLngs = selectedBounds.polygon.getLatLngs()[0]; // Получаем координаты полигона
        
        // Конвертируем LatLng объекты в массивы [lat, lng]
        const polygonCoords = polygonLatLngs.map(latlng => [latlng.lat, latlng.lng]);
        
        if (!pointInPolygon(node.lat, node.lon, polygonCoords)) {
          continue;
        }
      } catch (error) {
        console.error('Ошибка при проверке точки в полигоне:', error, selectedBounds.polygon);
        // В случае ошибки пропускаем этот узел
                continue;
              }
            }
            
    // Проверяем, что узел не в запретной зоне (используем ту же логику, что и в pointGeneration.js)
    if (forbiddenPolygons && forbiddenPolygons.length > 0) {
      let inForbiddenZone = false;
      for (let j = 0; j < forbiddenPolygons.length; j++) {
        const polygon = forbiddenPolygons[j];
        if (pointInPolygon(node.lat, node.lon, polygon)) {
          inForbiddenZone = true;
          break;
        }
      }
      if (inForbiddenZone) {
        continue;
      }
    }
    
    // Проверяем достижимость от стартовой точки (используем ту же логику, что и в pointGeneration.js)
    if (!isReachable(trailGraph, startNodeIdx, i)) {
      continue;
    }
    
    // Находим минимальное расстояние от этого узла до всех существующих точек
    let minDistance = Infinity;
    for (const point of allPoints) {
      const dist = haversine(node.lat, node.lon, point.lat, point.lng);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
    
    // Если этот узел дальше всех от существующих точек, сохраняем его
    if (minDistance > maxMinDistance) {
      maxMinDistance = minDistance;
      bestNodeIdx = i;
    }
  }
  
  if (bestNodeIdx === -1) {
    addApiLog('❌ Не найдено подходящее место для новой точки');
    return;
  }
  
  // Добавляем новую точку
  const bestNode = trailGraph.nodes[bestNodeIdx];
  
  // Финальная проверка: убеждаемся, что точка внутри полигона (если это полигон)
  if (selectedBounds.type === 'polygon' && selectedBounds.polygon) {
    try {
      const polygonLatLngs = selectedBounds.polygon.getLatLngs()[0];
      const polygonCoords = polygonLatLngs.map(latlng => [latlng.lat, latlng.lng]);
      if (!pointInPolygon(bestNode.lat, bestNode.lon, polygonCoords)) {
        addApiLog('❌ Выбранная точка оказалась вне полигона, попробуйте еще раз');
        return;
    }
  } catch (error) {
      console.error('Ошибка при финальной проверке точки в полигоне:', error);
      addApiLog('❌ Ошибка при проверке точки в полигоне');
      return;
    }
  }
  
  const newNumber = pointMarkers.length + 1;
  addPointMarker(bestNode.lat, bestNode.lon, newNumber);
  
  // Сохраняем индекс добавленной точки (индекс в массиве pointMarkers после добавления)
  const newPointIndex = pointMarkers.length - 1;
  addedPointsIndices.push(newPointIndex);
  
  addApiLog(`✅ Добавлена новая точка ${newNumber} (дальше от других: ${(maxMinDistance / 1000).toFixed(2)} км)`);
  
  // Пересчитываем последовательность
  const { resetSequence, generateOptimalSequence } = await import('./routeSequence.js');
  resetSequence();
  generateOptimalSequence();
  
  // Обновляем отображение
  const { updateSequenceDisplay } = await import('./sequenceUI.js');
  updateSequenceDisplay();
}

/**
 * Обновить состояние кнопок управления дистанцией
 */
async function updateDistanceButtonsState() {
  const { pointMarkers } = await import('./mapModule.js');
  
  // Кнопка - отключается, если точек <= 3
  if (distanceDecreaseBtn) {
    distanceDecreaseBtn.disabled = pointMarkers.length <= 3;
  }
  
  // Кнопка + отключается только если нет удаленных точек для восстановления и нет графа для добавления новой
  if (distanceIncreaseBtn) {
    // Кнопка всегда активна, если есть удаленные точки или граф доступен
    distanceIncreaseBtn.disabled = false;
  }
}

/**
 * Загрузка настроек из localStorage
 */
function loadSettingsFromStorage() {
  const runningWithMusicCheckbox = document.getElementById('runningWithMusic');
  if (runningWithMusicCheckbox) {
    const saved = localStorage.getItem('runningWithMusic');
    runningWithMusicCheckbox.checked = saved === 'true';
  } else {
    console.warn('⚠️ Элемент runningWithMusic не найден в DOM');
  }
}

/**
 * Обработчик изменения настройки "Бегаю с музыкой"
 */
function handleRunningWithMusicChange(event) {
  const isEnabled = event.target.checked;
  localStorage.setItem('runningWithMusic', isEnabled.toString());
  applyAudioSettings();
  console.log(`🎵 Режим "Бегаю с музыкой": ${isEnabled ? 'включен' : 'выключен'}`);
}

/**
 * Применение настроек аудио к аудиомодулю
 */
async function applyAudioSettings() {
  try {
    const { updateNavigationSettings } = await import('./audioModuleAdvanced.js');
    const runningWithMusicCheckbox = document.getElementById('runningWithMusic');
    const isEnabled = runningWithMusicCheckbox ? runningWithMusicCheckbox.checked : false;
    
    // Применяем настройки в зависимости от режима
    if (isEnabled) {
      // Режим "с музыкой": более высокие частоты, большая громкость, резкие звуки
      updateNavigationSettings({
        musicMode: true,
        frequencyMultiplier: 1.8,  // Повышаем частоту в 1.8 раза
        volumeMultiplier: 2.0,     // Увеличиваем громкость в 2 раза
        useSharpSounds: true       // Используем резкие звуки (square/sawtooth)
      });
    } else {
      // Обычный режим
      updateNavigationSettings({
        musicMode: false,
        frequencyMultiplier: 1.0,
        volumeMultiplier: 1.0,
        useSharpSounds: false
      });
    }
  } catch (error) {
    console.warn('⚠️ Не удалось применить настройки аудио:', error);
  }
}

/**
 * Показ модального окна с результатами навигации
 * @param {Object} stats - Статистика навигации
 */
export function showResultsModal(stats) {
  const resultsModal = document.getElementById('resultsModal');
  const resultsModalClose = document.getElementById('resultsModalClose');
  
  if (!resultsModal) {
    console.error('resultsModal не найден');
    return;
  }
  
  // Заполняем общую статистику
  document.getElementById('resultsPointsVisited').textContent = stats.pointsVisited;
  document.getElementById('resultsPointsTotal').textContent = stats.pointsTotal;
  document.getElementById('resultsIdealDistance').textContent = stats.idealDistance;
  document.getElementById('resultsRealDistance').textContent = stats.realDistance;
  document.getElementById('resultsDistanceDeviation').textContent = stats.distanceDeviation;
  document.getElementById('resultsDistanceDeviationPercent').textContent = `(${stats.distanceDeviationPercent}%)`;
  document.getElementById('resultsTotalTime').textContent = stats.totalTime;
  document.getElementById('resultsAvgSpeed').textContent = stats.avgSpeed;
  
  // Заполняем рейтинг
  const rating = stats.rating || 0;
  document.getElementById('resultsRating').textContent = rating;
  
  // Текст рейтинга
  let ratingText = '—';
  if (rating >= 90) ratingText = 'Отлично! 🌟';
  else if (rating >= 75) ratingText = 'Очень хорошо! 👍';
  else if (rating >= 60) ratingText = 'Хорошо! ✅';
  else if (rating >= 45) ratingText = 'Нормально';
  else if (rating >= 30) ratingText = 'Нужно улучшить';
  else ratingText = 'Попробуйте еще раз';
  
  document.getElementById('resultsRatingText').textContent = ratingText;
  
  // Заполняем таблицу точек
  const tableBody = document.getElementById('resultsPointsTableBody');
  if (tableBody && stats.pointDetails) {
    tableBody.innerHTML = '';
    
    stats.pointDetails.forEach((point, index) => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #dee2e6';
      if (index % 2 === 0) {
        row.style.background = '#f8f9fa';
      }
      
      // Цвет отклонения
      let deviationColor = '#28a745'; // зеленый
      let deviationText = point.deviation;
      if (point.deviationPercent) {
        const percent = parseFloat(point.deviationPercent);
        if (percent > 20) deviationColor = '#dc3545'; // красный
        else if (percent > 10) deviationColor = '#ffc107'; // желтый
        deviationText = `${point.deviation} км (${point.deviationPercent}%)`;
      }
      
      row.innerHTML = `
        <td style="padding: 10px 8px; font-weight: 600; color: #495057;">${point.pointNumber}</td>
        <td style="padding: 10px 8px; text-align: right; color: #495057;">${point.timeToReach}</td>
        <td style="padding: 10px 8px; text-align: right; color: #495057;">${point.idealDistance} км</td>
        <td style="padding: 10px 8px; text-align: right; color: #495057;">${point.realDistance}</td>
        <td style="padding: 10px 8px; text-align: right; color: ${deviationColor}; font-weight: ${point.deviationPercent ? '600' : '400'};">${deviationText}</td>
        <td style="padding: 10px 8px; text-align: right; color: #495057;">${point.avgSpeed}</td>
      `;
      
      tableBody.appendChild(row);
    });
  }
  
  // Показываем модальное окно
  resultsModal.style.display = 'flex';
  
  // Обработчик закрытия
  if (resultsModalClose) {
    resultsModalClose.onclick = () => {
      resultsModal.style.display = 'none';
    };
  }
  
  // Закрытие по клику вне окна
  resultsModal.onclick = (e) => {
    if (e.target === resultsModal) {
      resultsModal.style.display = 'none';
    }
  };
}

