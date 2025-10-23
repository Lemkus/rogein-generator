/**
 * Модуль звуковой навигации "Горячо-Холодно"
 * Обеспечивает навигацию к целевым точкам через звуковые сигналы
 */

import { haversine } from './utils.js';
import { pointMarkers, getStartPoint } from './mapModule.js';
import { playNavigationSound, playVictorySound, toggleAudio, isAudioOn, getSoundInterval, resetNavigation } from './audioModuleAdvanced.js';
import { getCurrentSequence, getNextPoint, isLastPoint } from './routeSequence.js';
import { enterFullscreenNavigation, exitFullscreenNavigation, updateDistanceDisplay } from './fullscreenNavigation.js';
import { initMediaSession, handleDistanceChange, stopNavigation as stopMediaNavigation } from './mediaSessionManager.js';

// Переменные навигации
let isNavigating = false;
let currentTarget = null;
let currentTargetIndex = null; // Индекс текущей целевой точки
let lastDistance = null;
let navigationInterval = null;
let userPosition = null;
let watchId = null;
let isAutoSequenceMode = false; // Режим автоматической последовательности
let completedPoints = new Set(); // Множество взятых точек
let isStoppingNavigation = false; // Флаг для предотвращения рекурсии

// Переменные для улучшенной навигации
let distanceHistory = []; // История расстояний для стабилизации
let directionHistory = []; // История направлений
const MAX_HISTORY_SIZE = 5; // Максимальный размер истории
const ACCURACY_ZONE_DISTANCE = 25; // Зона неопределенности (метры)
const CRITICAL_ZONE_DISTANCE = 15; // Критическая зона (метры)

// Переменные для предотвращения засыпания экрана
let wakeLock = null;
let noSleepInterval = null; // Fallback для браузеров без Wake Lock API

// DOM элементы (новый интерфейс)
let audioNavBtn, stopNavBtn, navStatus, targetPointSelect, targetPointContainer;

// Инициализация модуля навигации
export function initNavigation() {
  // Получаем элементы из нового интерфейса
  audioNavBtn = document.getElementById('startNavBtn'); // Новая кнопка
  stopNavBtn = document.getElementById('navStopBtn'); // Из полноэкранного режима
  navStatus = document.getElementById('navStatus'); // Может не существовать
  targetPointSelect = document.getElementById('navTargetSelect'); // Из полноэкранного режима
  targetPointContainer = document.getElementById('targetPointContainer'); // Может не существовать
  
  // Добавляем обработчики только если элементы существуют
  if (audioNavBtn) {
    audioNavBtn.addEventListener('click', startNavigation);
  }
  
  if (stopNavBtn) {
    stopNavBtn.addEventListener('click', stopNavigation);
  }
  
  // Обработчик изменения целевой точки
  if (targetPointSelect) {
    targetPointSelect.addEventListener('change', () => {
      if (!isNavigating) return;
      
      const value = targetPointSelect.value;
      if (value === '') return;
      
      // Пользователь выбрал другую точку
      const pointIdx = parseInt(value);
      if (!isNaN(pointIdx) && pointIdx >= 0 && pointIdx < pointMarkers.length) {
        const marker = pointMarkers[pointIdx];
        const coords = marker.getLatLng();
        currentTarget = coords;
        currentTargetIndex = pointIdx;
        lastDistance = null;
        
        updateNavStatus(`🎯 Целевая точка изменена на ${pointIdx + 1}`, 'blue');
        
        console.log(`🎯 Пользователь выбрал точку ${pointIdx + 1}`);
      }
    });
  }
  
  console.log('✅ Навигация инициализирована');
}

// Безопасная функция обновления статуса
function updateNavStatus(text, color = 'black') {
  if (navStatus) {
    navStatus.textContent = text;
    navStatus.style.color = color;
  }
}

// Обработка изменения видимости страницы (для Wake Lock)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Страница скрыта - Wake Lock может быть потерян
    console.log('📱 Страница скрыта - проверяем Wake Lock');
  } else {
    // Страница снова видна - пытаемся восстановить Wake Lock
    if (isNavigating && !wakeLock) {
      console.log('📱 Страница видна - восстанавливаем Wake Lock');
      activateWakeLock();
    }
  }
});

// Функция для добавления значения в историю
function addToHistory(history, value, maxSize = MAX_HISTORY_SIZE) {
  history.push(value);
  if (history.length > maxSize) {
    history.shift(); // Удаляем самый старый элемент
  }
}

// Функция для вычисления стабилизированного направления
function getStabilizedDirection(currentDistance, lastDistance) {
  if (lastDistance === null) return 'neutral';
  
  const distanceDiff = currentDistance - lastDistance;
  
  // Добавляем в историю
  addToHistory(distanceHistory, distanceDiff);
  
  // Вычисляем среднее изменение расстояния за последние измерения
  const avgDistanceChange = distanceHistory.reduce((sum, diff) => sum + diff, 0) / distanceHistory.length;
  
  // Определяем стабилизированное направление
  if (avgDistanceChange < -1) { // Приближаемся (расстояние уменьшается)
    return 'approaching';
  } else if (avgDistanceChange > 1) { // Удаляемся (расстояние увеличивается)
    return 'moving_away';
  }
  
  return 'neutral';
}

// Функция для получения адаптивного интервала обновления
function getAdaptiveUpdateInterval(distance) {
  if (distance < CRITICAL_ZONE_DISTANCE) {
    return 500; // 0.5 секунды в критической зоне
  } else if (distance < ACCURACY_ZONE_DISTANCE) {
    return 1000; // 1 секунда в зоне неопределенности
  } else if (distance < 50) {
    return 1500; // 1.5 секунды вблизи цели
  } else {
    return 2000; // 2 секунды на обычном расстоянии
  }
}

// Функция для получения текста статуса в зависимости от зоны
function getZoneStatusText(distance, direction) {
  if (distance < 10) {
    return '🎯 ЦЕЛЬ ДОСТИГНУТА!';
  } else if (distance < CRITICAL_ZONE_DISTANCE) {
    return `🔥 ОЧЕНЬ БЛИЗКО! ${distance.toFixed(0)}м`;
  } else if (distance < ACCURACY_ZONE_DISTANCE) {
    return `⚡ В ЗОНЕ ЦЕЛИ ${distance.toFixed(0)}м`;
  } else {
    const directionSymbol = direction === 'approaching' ? ' ↗️' : 
                           direction === 'moving_away' ? ' ↘️' : ' ➡️';
    return `📍 ${distance.toFixed(0)}м${directionSymbol}`;
  }
}

// Функция для активации Wake Lock (предотвращение засыпания экрана)
async function activateWakeLock() {
  // Освобождаем предыдущий lock если есть
  await releaseWakeLock();
  
  // Пытаемся использовать Wake Lock API
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('✅ Wake Lock активирован - экран не будет засыпать');
      
      // Обработка потери Wake Lock (например, при смене вкладки)
      wakeLock.addEventListener('release', () => {
        console.log('⚠️ Wake Lock потерян, пытаемся восстановить...');
        wakeLock = null;
        // Пытаемся восстановить Wake Lock
        setTimeout(() => {
          if (isNavigating) {
            activateWakeLock();
          }
        }, 1000);
      });
      
      return true;
    } catch (error) {
      console.log('❌ Не удалось активировать Wake Lock:', error);
      wakeLock = null;
    }
  }
  
  // Fallback: используем скрытое видео для предотвращения засыпания
  console.log('🔄 Используем fallback метод предотвращения засыпания');
  activateNoSleepFallback();
  return false;
}

// Fallback метод для предотвращения засыпания экрана
function activateNoSleepFallback() {
  // Создаем скрытое видео элемент
  const noSleepVideo = document.createElement('video');
  noSleepVideo.setAttribute('muted', '');
  noSleepVideo.setAttribute('playsinline', '');
  noSleepVideo.setAttribute('loop', '');
  noSleepVideo.style.display = 'none';
  
  // Создаем короткое видео (1 секунда черного экрана)
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 1, 1);
  
  // Конвертируем в blob и создаем URL
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    noSleepVideo.src = url;
    noSleepVideo.play();
    document.body.appendChild(noSleepVideo);
    
    // Периодически обновляем видео
    noSleepInterval = setInterval(() => {
      if (isNavigating && noSleepVideo.paused) {
        noSleepVideo.play();
      }
    }, 10000); // Каждые 10 секунд
    
    console.log('✅ Fallback метод активирован');
  });
}

// Функция для освобождения Wake Lock
async function releaseWakeLock() {
  // Освобождаем Wake Lock API
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('✅ Wake Lock освобожден');
    } catch (error) {
      console.log('❌ Ошибка при освобождении Wake Lock:', error);
    }
  }
  
  // Останавливаем fallback метод
  if (noSleepInterval) {
    clearInterval(noSleepInterval);
    noSleepInterval = null;
    
    // Удаляем скрытое видео
    const noSleepVideo = document.querySelector('video[style*="display: none"]');
    if (noSleepVideo) {
      URL.revokeObjectURL(noSleepVideo.src);
      noSleepVideo.remove();
    }
    
    console.log('✅ Fallback метод остановлен');
  }
}


// Функция воспроизведения звуковых сигналов с учётом направления и расстояния
function playNavigationSoundWithPattern(pattern, direction = 'neutral', distance = null) {
  if (isAudioOn()) {
    // Используем новую логику с мажор/минор аккордами
    if (distance !== null) {
      // Вычисляем скорость приближения/удаления
      let speed = 0;
      if (lastDistance !== null) {
        speed = lastDistance - distance; // Положительное = приближаемся, отрицательное = удаляемся
      }
      
      // Управление медиа при изменении расстояния
      handleDistanceChange(distance);
      
      // Проигрываем звук с новой логикой
      playNavigationSound(distance, speed);
    }
  }
}

// Получение координат целевой точки
function getTargetCoords() {
  const selectedValue = targetPointSelect.value;
  console.log(`🎯 Выбранная точка: "${selectedValue}"`);
  
  const startPoint = getStartPoint();
  
  // Режим автоматической последовательности
  if (selectedValue === 'auto') {
    isAutoSequenceMode = true;
    const sequence = getCurrentSequence();
    
    if (!sequence || sequence.length === 0) {
      console.log('❌ Нет последовательности для навигации');
      return null;
    }
    
    // Находим первую незавершенную точку в последовательности
    let nextPointIdx = null;
    for (let idx of sequence) {
      if (!completedPoints.has(idx)) {
        nextPointIdx = idx;
        break;
      }
    }
    
    // Если все точки взяты - возвращаемся к старту
    if (nextPointIdx === null) {
      console.log('🎉 Все точки взяты! Возврат к старту');
      currentTargetIndex = -1;
      return { lat: startPoint.lat, lng: startPoint.lng, index: -1 };
    }
    
    currentTargetIndex = nextPointIdx;
    const marker = pointMarkers[nextPointIdx];
    const coords = marker.getLatLng();
    console.log(`🎯 Автоматическая последовательность: точка ${nextPointIdx + 1}`);
    return { ...coords, index: nextPointIdx };
  }
  
  // Обычный режим
  isAutoSequenceMode = false;
  
  if (selectedValue === 'start' && startPoint) {
    console.log(`🎯 Используем стартовую точку: ${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}`);
    currentTargetIndex = -1;
    return { lat: startPoint.lat, lng: startPoint.lng, index: -1 };
  } else if (selectedValue !== '' && pointMarkers[selectedValue]) {
    const marker = pointMarkers[selectedValue];
    const coords = marker.getLatLng();
    const idx = parseInt(selectedValue);
    currentTargetIndex = idx;
    console.log(`🎯 Используем точку ${idx + 1}: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    return { ...coords, index: idx };
  }
  
  console.log('❌ Не удалось получить координаты цели');
  return null;
}

// Основная логика навигации с улучшенной точностью
function navigationStep() {
  if (!isNavigating || !userPosition || !currentTarget) {
    return;
  }
  
  const distance = haversine(userPosition.lat, userPosition.lng, currentTarget.lat, currentTarget.lng);
  
  // Вычисляем скорость приближения/удаления
  let speed = 0;
  if (lastDistance !== null) {
    speed = lastDistance - distance; // Положительное = приближаемся, отрицательное = удаляемся
  }
  
  // Получаем стабилизированное направление
  const direction = getStabilizedDirection(distance, lastDistance);
  
  // Получаем текст статуса в зависимости от зоны
  const statusText = getZoneStatusText(distance, direction);
  
  // Обновляем статус с улучшенной индикацией
  updateNavStatus(statusText);
  
  // Обновляем отображение расстояния в полноэкранном режиме
  updateDistanceDisplay(distance, statusText);
  
  // Устанавливаем цвет в зависимости от зоны
  if (distance < 10) {
    updateNavStatus(statusText, 'green');
  } else if (distance < CRITICAL_ZONE_DISTANCE) {
    updateNavStatus(statusText, 'red');
  } else if (distance < ACCURACY_ZONE_DISTANCE) {
    updateNavStatus(statusText, 'orange');
  } else {
    updateNavStatus(statusText, 'black');
  }
  
  // Проверяем достижение цели
  if (distance < 10) {
    // Отмечаем точку как взятую
    if (currentTargetIndex !== null && currentTargetIndex >= 0) {
      completedPoints.add(currentTargetIndex);
      console.log(`✅ Точка ${currentTargetIndex + 1} взята!`);
    }
    
    // Звук победы с callback для автоматического переключения
    playVictorySound(() => {
      // Callback вызывается после завершения победного звука
      if (isAutoSequenceMode && isNavigating) {
        switchToNextPoint();
      }
    });
    
    updateNavStatus('🎯 ЦЕЛЬ ДОСТИГНУТА!', 'green');
    
    // Показываем уведомление
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Рогейн', {
        body: `Точка ${currentTargetIndex >= 0 ? currentTargetIndex + 1 : 'СТАРТ'} достигнута! 🎯`,
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiM0Q0FGNTAiLz4KPHBhdGggZD0iTTk2IDQ4TDEwOCA2NEwxMjggNzJMMTA4IDgwTDk2IDk2TDg0IDgwTDY0IDcyTDg0IDY0TDk2IDQ4WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==',
      });
    }
    
    setTimeout(() => {
      if (!isAutoSequenceMode) {
        updateNavStatus('', 'black');
      }
    }, 3000);
    return;
  }
  
  // Управление медиа при изменении расстояния
  handleDistanceChange(distance);
  
  // Проигрываем звук с новой логикой
  playNavigationSound(distance, speed);
  
  // Получаем адаптивный интервал обновления
  const adaptiveInterval = getAdaptiveUpdateInterval(distance);
  
  // Получаем интервал для следующего звука (из аудио модуля)
  const soundDelay = getSoundInterval(distance) * 1000; // Конвертируем в миллисекунды
  
  lastDistance = distance;
  
  // Планируем следующую проверку с адаптивным интервалом
  clearTimeout(navigationInterval);
  clearInterval(navigationInterval);
  
  // Используем меньший из двух интервалов для более отзывчивой навигации
  const finalInterval = Math.min(adaptiveInterval, soundDelay);
  
  navigationInterval = setInterval(() => {
    navigationStep();
  }, finalInterval);
}

// Обработка изменения позиции пользователя
function onPositionUpdate(position) {
  userPosition = {
    lat: position.coords.latitude,
    lng: position.coords.longitude
  };
  
  if (isNavigating) {
    navigationStep();
  }
}

// Обработка ошибок геолокации
function onPositionError(error) {
  updateNavStatus(`❌ Ошибка геолокации: ${error.message}`, 'red');
}

// Начало навигации
async function startNavigation() {
  console.log('🚀 startNavigation вызвана');
  
  // Проверяем наличие последовательности
  const sequence = getCurrentSequence();
  console.log('📋 Полученная последовательность:', sequence);
  
  if (!sequence || sequence.length === 0) {
    console.warn('⚠️ Последовательность пустая или не найдена');
    alert('Сначала сгенерируйте точки!');
    return;
  }
  
  // Автоматически включаем режим автопоследовательности
  isAutoSequenceMode = true;
  
  // Начинаем с первой точки последовательности
  const firstPointIdx = sequence[0];
  const marker = pointMarkers[firstPointIdx];
  const coords = marker.getLatLng();
  
  currentTarget = coords;
  currentTargetIndex = firstPointIdx;
  isNavigating = true;
  
  // Входим в полноэкранный режим навигации
  enterFullscreenNavigation();
  lastDistance = null;
  
  // Очищаем историю для новой навигации
  distanceHistory = [];
  directionHistory = [];
  
  // Сбрасываем состояние аудио модуля для новой навигации
  resetNavigation();
  
  // Показываем селект с целевой точкой и обновляем его
  if (targetPointContainer) {
    targetPointContainer.style.display = 'block';
  }
  updateTargetPointsList();
  
  // Активируем предотвращение засыпания экрана
  await activateWakeLock();
  
  // Запрашиваем геолокацию
  if ('geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      onPositionUpdate, 
      onPositionError,
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000
      }
    );
    
    updateNavStatus('🔍 Поиск GPS...', 'blue');
    
    if (audioNavBtn) audioNavBtn.style.display = 'none';
    if (stopNavBtn) stopNavBtn.style.display = 'inline-block';
    
    // Приветственный звуковой сигнал
    playNavigationSound(100, 0); // Расстояние 100м, скорость 0
  } else {
    alert('Геолокация не поддерживается вашим браузером!');
  }
}

// Переключение на следующую точку в последовательности
function switchToNextPoint() {
  if (!isAutoSequenceMode) return;
  
  const sequence = getCurrentSequence();
  if (!sequence || sequence.length === 0) {
    console.log('❌ Нет последовательности для продолжения');
    stopNavigation();
    return;
  }
  
  // Находим следующую точку в последовательности ПОСЛЕ текущей
  let nextPointIdx = null;
  const currentIdx = sequence.indexOf(currentTargetIndex);
  
  if (currentIdx !== -1) {
    // Ищем следующую точку в последовательности после текущей
    for (let i = currentIdx + 1; i < sequence.length; i++) {
      const idx = sequence[i];
      if (!completedPoints.has(idx)) {
        nextPointIdx = idx;
        break;
      }
    }
  } else {
    // Если текущая точка не найдена в последовательности, 
    // ищем первую незавершенную точку
    for (let idx of sequence) {
      if (!completedPoints.has(idx)) {
        nextPointIdx = idx;
        break;
      }
    }
  }
  
  // Если все точки взяты - возвращаемся к старту
  if (nextPointIdx === null) {
    const startPoint = getStartPoint();
    if (startPoint) {
      currentTarget = { lat: startPoint.lat, lng: startPoint.lng };
      currentTargetIndex = -1;
      lastDistance = null;
      updateNavStatus('🏁 Возврат к старту...', 'blue');
      console.log('🏁 Все точки взяты! Возврат к старту');
      
      // Обновляем список точек
      updateTargetPointsList();
    } else {
      stopNavigation();
    }
    return;
  }
  
  // Переключаемся на следующую точку
  const marker = pointMarkers[nextPointIdx];
  const coords = marker.getLatLng();
  currentTarget = coords;
  currentTargetIndex = nextPointIdx;
  lastDistance = null;
  
  updateNavStatus(`📍 Следующая: Точка ${nextPointIdx + 1}`, 'blue');
  console.log(`📍 Переключение на точку ${nextPointIdx + 1}`);
  
  // Обновляем список точек для отображения галочек
  updateTargetPointsList();
  
  // Продолжаем навигацию
  setTimeout(() => {
    if (isNavigating && userPosition) {
      navigationStep();
    }
  }, 1000);
}

// Остановка навигации
async function stopNavigation() {
  // Предотвращаем рекурсию
  if (isStoppingNavigation) {
    return;
  }
  isStoppingNavigation = true;
  
  isNavigating = false;
  isAutoSequenceMode = false;
  
  // Останавливаем управление медиа
  stopMediaNavigation();
  
  // Выходим из полноэкранного режима навигации
  exitFullscreenNavigation();
  
  // Освобождаем Wake Lock
  await releaseWakeLock();
  
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  
  if (navigationInterval) {
    clearTimeout(navigationInterval);
    clearInterval(navigationInterval);
    navigationInterval = null;
  }
  
  updateNavStatus('');
  if (audioNavBtn) audioNavBtn.style.display = 'inline-block';
  if (stopNavBtn) stopNavBtn.style.display = 'none';
  
  // Скрываем селект с целевой точкой
  if (targetPointContainer) {
    targetPointContainer.style.display = 'none';
  }
  
  // НЕ перегенерируем последовательность при остановке навигации
  // Просто обновляем доступность кнопки
  const sequence = getCurrentSequence();
  if (pointMarkers.length === 0 || !sequence || sequence.length === 0) {
    audioNavBtn.disabled = true;
  } else {
    audioNavBtn.disabled = false;
  }
  
  // Финальный звуковой сигнал
  playNavigationSound(200, 0); // Расстояние 200м, скорость 0
  
  // Сбрасываем флаг
  isStoppingNavigation = false;
}

// Обновление доступности кнопки навигации и селекта точек
function updateTargetPointsList() {
  // Включаем/отключаем кнопку навигации в зависимости от наличия точек и последовательности
  const sequence = getCurrentSequence();
  if (pointMarkers.length === 0 || !sequence || sequence.length === 0) {
    audioNavBtn.disabled = true;
  } else {
    audioNavBtn.disabled = false;
  }
  
  // Обновляем основной селект (показывается только во время навигации)
  if (targetPointSelect && isNavigating) {
    let html = '';
    
    // Добавляем все точки из последовательности
    if (sequence && sequence.length > 0) {
      sequence.forEach((pointIndex) => {
        const pointNumber = pointIndex + 1;
        const isCompleted = completedPoints.has(pointIndex);
        const checkmark = isCompleted ? '✓ ' : '';
        const isCurrent = currentTargetIndex === pointIndex;
        html += `<option value="${pointIndex}" ${isCurrent ? 'selected' : ''}>${checkmark}Точка ${pointNumber}${isCurrent ? ' (текущая)' : ''}</option>`;
      });
    }
    
    targetPointSelect.innerHTML = html;
  }
  
  // Обновляем навигационный селект в полноэкранном режиме
  const navSelect = document.getElementById('navTargetSelect');
  if (navSelect && isNavigating) {
    let html = '';
    
    // Добавляем все точки из последовательности
    if (sequence && sequence.length > 0) {
      sequence.forEach((pointIndex) => {
        const pointNumber = pointIndex + 1;
        const isCompleted = completedPoints.has(pointIndex);
        const checkmark = isCompleted ? '✓ ' : '';
        const isCurrent = currentTargetIndex === pointIndex;
        html += `<option value="${pointIndex}" ${isCurrent ? 'selected' : ''}>${checkmark}Точка ${pointNumber}${isCurrent ? ' (текущая)' : ''}</option>`;
      });
    }
    
    navSelect.innerHTML = html;
  }
}

// Сброс завершенных точек (при новой генерации)
function resetCompletedPoints() {
  completedPoints.clear();
  updateTargetPointsList();
  console.log('🔄 Список завершенных точек очищен');
}

// Экспорт функций для внешнего использования
export { isNavigating, currentTarget, userPosition, resetCompletedPoints, stopNavigation, updateTargetPointsList, startNavigation }; 