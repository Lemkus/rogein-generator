/**
 * Модуль полноэкранного режима навигации
 * Управляет переключением в полноэкранный режим и обратно
 */

import { map } from './mapModule.js';
import { updateTargetPointsList, stopNavigation } from './navigation.js';
import { toggleAudio, isAudioOn } from './audioModuleAdvanced.js';

// Элементы DOM
let fullscreenContainer = null;
let fullscreenMap = null;
let distanceDisplay = null;
let targetSelect = null;
let stopBtn = null;
let toggleAudioBtn = null;
let exitBtn = null;

// Состояние
let isFullscreenActive = false;
let originalMapContainer = null;

/**
 * Инициализация полноэкранного режима навигации
 */
export function initFullscreenNavigation() {
  // Получаем элементы DOM
  fullscreenContainer = document.getElementById('navigationFullscreen');
  fullscreenMap = document.getElementById('navFullscreenMap');
  distanceDisplay = document.getElementById('navDistanceDisplay');
  targetSelect = document.getElementById('navTargetSelect');
  stopBtn = document.getElementById('navStopBtn');
  toggleAudioBtn = document.getElementById('navToggleAudioBtn');
  exitBtn = document.getElementById('navExitBtn');
  
  if (!fullscreenContainer || !fullscreenMap) {
    console.error('❌ Не найдены элементы полноэкранного режима');
    return;
  }
  
  // Настраиваем обработчики событий
  stopBtn.addEventListener('click', handleStopNavigation);
  toggleAudioBtn.addEventListener('click', handleToggleAudio);
  exitBtn.addEventListener('click', exitFullscreenNavigation);
  targetSelect.addEventListener('change', handleTargetChange);
  
  console.log('✅ Полноэкранный режим навигации инициализирован');
}

/**
 * Вход в полноэкранный режим навигации
 */
export function enterFullscreenNavigation() {
  if (isFullscreenActive) {
    return;
  }
  
  console.log('🖥️ Вход в полноэкранный режим навигации');
  
  // Сохраняем ссылку на оригинальный контейнер карты
  originalMapContainer = map.getContainer().parentElement;
  
  // Перемещаем карту в полноэкранный контейнер
  fullscreenMap.appendChild(map.getContainer());
  
  // Показываем полноэкранный режим
  fullscreenContainer.classList.add('active');
  isFullscreenActive = true;
  
  // Обновляем размер карты
  setTimeout(() => {
    map.invalidateSize();
    // Принудительно обновляем размер карты
    const mapContainer = map.getContainer();
    if (mapContainer) {
      mapContainer.style.width = '100%';
      mapContainer.style.height = '100%';
    }
    map.invalidateSize();
  }, 100);
  
  // Дополнительное обновление через больший интервал
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
  
  // Обновляем элементы управления
  updateFullscreenControls();
  
  // Скрываем основной интерфейс
  hideMainInterface();
}

/**
 * Выход из полноэкранного режима навигации
 */
export function exitFullscreenNavigation() {
  if (!isFullscreenActive) {
    return;
  }
  
  console.log('🖥️ Выход из полноэкранного режима навигации');
  
  // НЕ вызываем stopNavigation здесь, чтобы избежать рекурсии
  // stopNavigation сам вызовет exitFullscreenNavigation
  
  // Возвращаем карту в оригинальный контейнер
  if (originalMapContainer) {
    originalMapContainer.appendChild(map.getContainer());
  }
  
  // Скрываем полноэкранный режим
  fullscreenContainer.classList.remove('active');
  isFullscreenActive = false;
  
  // Обновляем размер карты
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
  
  // Показываем основной интерфейс
  showMainInterface();
}

/**
 * Показать основной интерфейс после выхода из полноэкранного режима
 */
function showMainInterface() {
  // Убираем все inline стили с карты
  const mapElement = document.getElementById('map');
  if (mapElement) {
    mapElement.style.removeProperty('display');
    mapElement.style.removeProperty('visibility');
    mapElement.style.removeProperty('height');
    mapElement.style.removeProperty('width');
  }
  
  // Явно закрываем все модальные окна, которые могли открыться
  const routesModal = document.getElementById('routesModal');
  if (routesModal) {
    routesModal.style.display = 'none';
  }
  
  const sequenceModal = document.getElementById('sequenceModal');
  if (sequenceModal) {
    sequenceModal.style.display = 'none';
  }
  
  const menuModal = document.getElementById('menuModal');
  if (menuModal) {
    menuModal.classList.remove('show');
  }
  
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) {
    settingsModal.classList.remove('show');
  }
  
  // Принудительно обновляем карту - это восстановит её размер
  setTimeout(() => {
    if (map && map.invalidateSize) {
      map.invalidateSize();
    }
  }, 100);
  
  console.log('🖥️ Основной интерфейс восстановлен');
}

/**
 * Обновление элементов управления в полноэкранном режиме
 */
function updateFullscreenControls() {
  // Обновляем список целевых точек
  updateTargetPointsList();
  
  // Синхронизируем выбор целевой точки
  const mainSelect = document.getElementById('targetPointSelect');
  if (mainSelect && targetSelect) {
    targetSelect.innerHTML = mainSelect.innerHTML;
    targetSelect.value = mainSelect.value;
  }
  
  // Обновляем состояние кнопки звука
  updateAudioButtonState();
}

/**
 * Обновление состояния кнопки звука
 */
function updateAudioButtonState() {
  if (isAudioOn()) {
    toggleAudioBtn.textContent = '🔊';
    toggleAudioBtn.title = 'Отключить звук';
  } else {
    toggleAudioBtn.textContent = '🔇';
    toggleAudioBtn.title = 'Включить звук';
  }
}

/**
 * Обновление отображения расстояния
 */
export function updateDistanceDisplay(distance, status) {
  if (!distanceDisplay) {
    return;
  }
  
  let distanceText = 'Расстояние: - м';
  if (distance !== null && distance !== undefined) {
    distanceText = `Расстояние: ${Math.round(distance)} м`;
  }
  
  if (status) {
    distanceText += ` | ${status}`;
  }
  
  distanceDisplay.textContent = distanceText;
}

/**
 * Скрытие основного интерфейса
 */
function hideMainInterface() {
  const elementsToHide = [
    'h2', // Заголовок
    '.controls', // Все панели управления
    '#sequenceSection', // Секция последовательности
    '#routesModal', // Окно сохраненных маршрутов
    '#sequenceModal', // Окно редактирования последовательности
    '#menuModal', // Меню
    '#settingsModal' // Настройки
  ];
  
  elementsToHide.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.style.display = 'none';
    });
  });
}


/**
 * Обработчик остановки навигации
 */
function handleStopNavigation() {
  stopNavigation();
  exitFullscreenNavigation();
}

/**
 * Обработчик переключения звука
 */
function handleToggleAudio() {
  toggleAudio();
  updateAudioButtonState();
  console.log(`🔊 Звук ${isAudioOn() ? 'включен' : 'отключен'}`);
}

/**
 * Обработчик изменения целевой точки
 */
function handleTargetChange() {
  const mainSelect = document.getElementById('targetPointSelect');
  if (mainSelect) {
    mainSelect.value = targetSelect.value;
    mainSelect.dispatchEvent(new Event('change'));
  }
}

/**
 * Проверка, активен ли полноэкранный режим
 */
export function getFullscreenState() {
  return isFullscreenActive;
}
