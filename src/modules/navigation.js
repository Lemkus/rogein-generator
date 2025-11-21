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

// Переменные для трекинга маршрута и статистики
let routeTrack = []; // Массив позиций пользователя {lat, lng, timestamp, distance}
let navigationStartTime = null; // Время начала навигации
let pointReachTimes = new Map(); // Время достижения каждой точки {pointIndex: timestamp}
let pointStartTimes = new Map(); // Время начала движения к точке {pointIndex: timestamp}
let pointDistances = new Map(); // Расстояние до точки при старте движения {pointIndex: distance}

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
  
  // Обработчик закрытия страницы - подтверждение при активной навигации
  window.addEventListener('beforeunload', (e) => {
    if (isNavigating) {
      // Стандартный способ показать диалог подтверждения
      e.preventDefault();
      // Для Chrome требуется установить returnValue
      e.returnValue = 'Вы уверены, что хотите завершить навигацию?';
      return e.returnValue;
    }
  });
  
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
    // Если это старт и все точки взяты - показываем результаты
    if (currentTargetIndex === -1 && isAutoSequenceMode) {
      const sequence = getCurrentSequence();
      const allPointsCompleted = sequence.every(idx => completedPoints.has(idx));
      
      if (allPointsCompleted) {
        // Все точки взяты и вернулись к старту - показываем результаты
        pointReachTimes.set(-1, Date.now()); // Сохраняем время достижения старта
        showResultsWindow();
        return;
      }
    }
    
    // Отмечаем точку как взятую
    if (currentTargetIndex !== null && currentTargetIndex >= 0) {
      completedPoints.add(currentTargetIndex);
      pointReachTimes.set(currentTargetIndex, Date.now());
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
    // Трекинг маршрута
    const now = Date.now();
    const distance = currentTarget ? haversine(
      userPosition.lat, userPosition.lng,
      currentTarget.lat, currentTarget.lng
    ) : null;
    
    routeTrack.push({
      lat: userPosition.lat,
      lng: userPosition.lng,
      timestamp: now,
      distance: distance,
      accuracy: position.coords.accuracy || null,
      targetIndex: currentTargetIndex
    });
    
    // Ограничиваем размер для производительности (последние 10000 точек)
    if (routeTrack.length > 10000) {
      routeTrack.shift();
    }
    
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
  
  // Добавляем класс к body для скрытия footer
  document.body.classList.add('navigating');
  
  // Входим в полноэкранный режим навигации
  enterFullscreenNavigation();
  lastDistance = null;
  
  // Очищаем историю для новой навигации
  distanceHistory = [];
  directionHistory = [];
  
  // Сбрасываем состояние аудио модуля для новой навигации
  resetNavigation();
  
  // Сбрасываем трекинг
  routeTrack = [];
  navigationStartTime = Date.now();
  pointReachTimes.clear();
  pointStartTimes.clear();
  pointDistances.clear();
  completedPoints.clear();
  
  // Сохраняем время начала движения к первой точке
  pointStartTimes.set(firstPointIdx, Date.now());
  if (userPosition) {
    const initialDistance = haversine(userPosition.lat, userPosition.lng, coords.lat, coords.lng);
    pointDistances.set(firstPointIdx, initialDistance);
  }
  
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
      
      // Сохраняем время начала движения к старту
      pointStartTimes.set(-1, Date.now());
      if (userPosition) {
        const initialDistance = haversine(userPosition.lat, userPosition.lng, startPoint.lat, startPoint.lng);
        pointDistances.set(-1, initialDistance);
      }
      
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
  
  // Сохраняем время начала движения к следующей точке
  pointStartTimes.set(nextPointIdx, Date.now());
  if (userPosition) {
    const initialDistance = haversine(userPosition.lat, userPosition.lng, coords.lat, coords.lng);
    pointDistances.set(nextPointIdx, initialDistance);
  }
  
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
  
  // Удаляем класс из body для показа footer
  document.body.classList.remove('navigating');
  
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

// Функция расчета детальной статистики по точкам
async function calculatePointDetails() {
  const sequence = getCurrentSequence();
  const startPoint = getStartPoint();
  const { getTrailGraph } = await import('./routeSequence.js');
  const { dijkstra, findNearestNodeIdx } = await import('./algorithms.js');
  
  const pointDetails = [];
  let prevPos = startPoint;
  
  // Получаем граф для расчета идеальных расстояний
  const trailGraph = getTrailGraph();
  
  // Функция расчета идеального расстояния
  const getIdealDistance = (from, to) => {
    if (trailGraph && trailGraph.nodes && trailGraph.nodes.length > 0) {
      const fromNodeIdx = findNearestNodeIdx(from.lat, from.lng, trailGraph.nodes);
      const toNodeIdx = findNearestNodeIdx(to.lat, to.lng, trailGraph.nodes);
      if (fromNodeIdx !== -1 && toNodeIdx !== -1) {
        const result = dijkstra(trailGraph, fromNodeIdx, toNodeIdx);
        if (result.distance < Infinity) return result.distance;
      }
    }
    return haversine(from.lat, from.lng, to.lat, to.lng);
  };
  
  for (const pointIdx of sequence) {
    const pointCoords = pointMarkers[pointIdx].getLatLng();
    const startTime = pointStartTimes.get(pointIdx);
    const reachTime = pointReachTimes.get(pointIdx);
    const initialDistance = pointDistances.get(pointIdx) || 0;
    
    // Время до достижения точки (в секундах)
    const timeToReach = startTime && reachTime ? (reachTime - startTime) / 1000 : null;
    
    // Идеальное расстояние
    const idealDistance = getIdealDistance(prevPos, pointCoords);
    
    // Реальное расстояние (по треку)
    let realDistance = 0;
    if (startTime && reachTime) {
      // Берем все точки трека в этом временном диапазоне
      // (не фильтруем по targetIndex, так как он может меняться)
      const trackSegment = routeTrack.filter(
        p => p.timestamp >= startTime && p.timestamp <= reachTime
      );
      for (let i = 1; i < trackSegment.length; i++) {
        realDistance += haversine(
          trackSegment[i-1].lat, trackSegment[i-1].lng,
          trackSegment[i].lat, trackSegment[i].lng
        );
      }
    }
    
    // Отклонение от идеального маршрута
    const deviation = realDistance > 0 ? realDistance - idealDistance : null;
    const deviationPercent = realDistance > 0 && idealDistance > 0 
      ? ((deviation / idealDistance) * 100).toFixed(1) 
      : null;
    
    // Средняя скорость (м/с)
    const avgSpeed = timeToReach && timeToReach > 0 && realDistance > 0 
      ? (realDistance / timeToReach).toFixed(2) 
      : null;
    
    pointDetails.push({
      pointIndex: pointIdx,
      pointNumber: pointIdx + 1,
      timeToReach: timeToReach ? formatTime(timeToReach) : '—',
      timeToReachSeconds: timeToReach,
      idealDistance: (idealDistance / 1000).toFixed(2),
      realDistance: realDistance > 0 ? (realDistance / 1000).toFixed(2) : '—',
      deviation: deviation !== null ? (deviation / 1000).toFixed(2) : '—',
      deviationPercent: deviationPercent,
      avgSpeed: avgSpeed ? `${avgSpeed} м/с` : '—',
      initialDistance: (initialDistance / 1000).toFixed(2)
    });
    
    prevPos = pointCoords;
  }
  
  return pointDetails;
}

// Функция форматирования времени
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}ч ${minutes}м ${secs}с`;
  } else if (minutes > 0) {
    return `${minutes}м ${secs}с`;
  } else {
    return `${secs}с`;
  }
}

// Функция расчета рейтинга прохождения (1-100)
async function calculateRating() {
  const sequence = getCurrentSequence();
  const startPoint = getStartPoint();
  const { getRouteStats } = await import('./routeSequence.js');
  
  if (!navigationStartTime || routeTrack.length < 10) {
    return 50; // Базовый рейтинг если данных недостаточно
  }
  
  const routeStats = getRouteStats();
  if (!routeStats) return 50;
  
  // 1. Эффективность маршрута (0-30 баллов)
  // Рассчитываем реальное расстояние
  let realDistance = 0;
  for (let i = 1; i < routeTrack.length; i++) {
    realDistance += haversine(
      routeTrack[i-1].lat, routeTrack[i-1].lng,
      routeTrack[i].lat, routeTrack[i].lng
    );
  }
  
  const idealDistance = routeStats.totalDistance;
  const efficiency = idealDistance > 0 ? (idealDistance / realDistance) : 0;
  const efficiencyScore = Math.min(30, efficiency * 30);
  
  // 2. Процент взятых точек (0-25 баллов)
  const pointsVisited = completedPoints.size;
  const pointsTotal = sequence.length;
  const pointsScore = (pointsVisited / pointsTotal) * 25;
  
  // 3. Процент рысканий (0-20 баллов) - меньше рысканий = больше баллов
  const wanderingPercent = calculateWanderingPercent();
  const wanderingScore = Math.max(0, 20 - (wanderingPercent / 5)); // За каждые 5% рысканий -1 балл
  
  // 4. Равномерность темпа (0-15 баллов)
  const paceScore = calculatePaceScore();
  
  // 5. Точность навигации (0-10 баллов)
  const accuracyScore = calculateAccuracyScore();
  
  const totalRating = Math.round(
    efficiencyScore + pointsScore + wanderingScore + paceScore + accuracyScore
  );
  
  return Math.max(1, Math.min(100, totalRating));
}

// Функция расчета процента рысканий
function calculateWanderingPercent() {
  if (routeTrack.length < 10) return 0;
  
  // Вычисляем среднюю скорость за весь маршрут
  let totalDistance = 0;
  let totalTime = 0;
  for (let i = 1; i < routeTrack.length; i++) {
    const dist = haversine(
      routeTrack[i-1].lat, routeTrack[i-1].lng,
      routeTrack[i].lat, routeTrack[i].lng
    );
    const time = (routeTrack[i].timestamp - routeTrack[i-1].timestamp) / 1000;
    if (time > 0) {
      totalDistance += dist;
      totalTime += time;
    }
  }
  const avgSpeed = totalTime > 0 ? totalDistance / totalTime : 0;
  
  // Находим участки с низкой скоростью (рыскания)
  let wanderingDistance = 0;
  const SLOW_SPEED_THRESHOLD = avgSpeed * 0.5; // 50% от средней скорости
  
  for (let i = 1; i < routeTrack.length; i++) {
    const dist = haversine(
      routeTrack[i-1].lat, routeTrack[i-1].lng,
      routeTrack[i].lat, routeTrack[i].lng
    );
    const time = (routeTrack[i].timestamp - routeTrack[i-1].timestamp) / 1000;
    const speed = time > 0 ? dist / time : 0;
    
    if (speed < SLOW_SPEED_THRESHOLD && speed > 0) {
      wanderingDistance += dist;
    }
  }
  
  return totalDistance > 0 ? (wanderingDistance / totalDistance) * 100 : 0;
}

// Функция расчета равномерности темпа
function calculatePaceScore() {
  if (routeTrack.length < 20) return 7.5; // Средний балл
  
  // Вычисляем скорости на разных участках
  const speeds = [];
  const segmentSize = Math.floor(routeTrack.length / 5); // 5 сегментов
  
  for (let seg = 0; seg < 5; seg++) {
    let segmentDistance = 0;
    let segmentTime = 0;
    const startIdx = seg * segmentSize;
    const endIdx = Math.min(startIdx + segmentSize, routeTrack.length - 1);
    
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const dist = haversine(
        routeTrack[i-1].lat, routeTrack[i-1].lng,
        routeTrack[i].lat, routeTrack[i].lng
      );
      const time = (routeTrack[i].timestamp - routeTrack[i-1].timestamp) / 1000;
      if (time > 0) {
        segmentDistance += dist;
        segmentTime += time;
      }
    }
    
    if (segmentTime > 0) {
      speeds.push(segmentDistance / segmentTime);
    }
  }
  
  if (speeds.length < 3) return 7.5;
  
  // Вычисляем коэффициент вариации (стандартное отклонение / среднее)
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - avgSpeed, 2), 0) / speeds.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = avgSpeed > 0 ? stdDev / avgSpeed : 1;
  
  // Меньше вариация = больше баллов (максимум 15)
  return Math.max(0, 15 - (coefficientOfVariation * 10));
}

// Функция расчета точности навигации
function calculateAccuracyScore() {
  const sequence = getCurrentSequence();
  if (sequence.length === 0) return 5;
  
  // Считаем среднее отклонение от идеального маршрута по точкам
  let totalDeviation = 0;
  let validPoints = 0;
  
  for (const pointIdx of sequence) {
    const startTime = pointStartTimes.get(pointIdx);
    const reachTime = pointReachTimes.get(pointIdx);
    
    if (startTime && reachTime) {
      const trackSegment = routeTrack.filter(
        p => p.timestamp >= startTime && p.timestamp <= reachTime
      );
      
      if (trackSegment.length > 5) {
        // Приблизительно оцениваем отклонение по количеству точек в зоне поиска
        const inAccuracyZone = trackSegment.filter(p => p.distance && p.distance < ACCURACY_ZONE_DISTANCE).length;
        const accuracyRatio = inAccuracyZone / trackSegment.length;
        
        // Меньше времени в зоне поиска = лучше (максимум 10 баллов)
        totalDeviation += accuracyRatio;
        validPoints++;
      }
    }
  }
  
  if (validPoints === 0) return 5;
  
  const avgDeviation = totalDeviation / validPoints;
  return Math.max(0, 10 - (avgDeviation * 10));
}

// Функция показа окна результатов
async function showResultsWindow() {
  const sequence = getCurrentSequence();
  const { getRouteStats } = await import('./routeSequence.js');
  
  // Рассчитываем общую статистику
  const routeStats = getRouteStats();
  const pointsVisited = completedPoints.size;
  const pointsTotal = sequence.length;
  
  // Реальное расстояние
  let realDistance = 0;
  for (let i = 1; i < routeTrack.length; i++) {
    realDistance += haversine(
      routeTrack[i-1].lat, routeTrack[i-1].lng,
      routeTrack[i].lat, routeTrack[i].lng
    );
  }
  
  const idealDistance = routeStats ? routeStats.totalDistance : 0;
  const distanceDeviation = realDistance - idealDistance;
  const distanceDeviationPercent = idealDistance > 0 
    ? ((distanceDeviation / idealDistance) * 100).toFixed(1) 
    : '0';
  
  // Общее время
  const totalTime = navigationStartTime && pointReachTimes.has(-1)
    ? (pointReachTimes.get(-1) - navigationStartTime) / 1000
    : 0;
  
  // Средняя скорость
  const avgSpeed = totalTime > 0 && realDistance > 0
    ? ((realDistance / totalTime) * 3.6).toFixed(2) // км/ч
    : '0';
  
  // Детализация по точкам
  const pointDetails = await calculatePointDetails();
  
  // Рейтинг
  const rating = await calculateRating();
  
  const stats = {
    pointsVisited,
    pointsTotal,
    idealDistance: (idealDistance / 1000).toFixed(2),
    realDistance: (realDistance / 1000).toFixed(2),
    distanceDeviation: (distanceDeviation / 1000).toFixed(2),
    distanceDeviationPercent,
    totalTime: formatTime(totalTime),
    avgSpeed,
    pointDetails,
    rating
  };
  
  // Импортируем функцию показа модального окна
  const { showResultsModal } = await import('./uiController.js');
  showResultsModal(stats);
  
  // Останавливаем навигацию
  await stopNavigation();
}

// Экспорт функций для внешнего использования
export { isNavigating, currentTarget, userPosition, resetCompletedPoints, stopNavigation, updateTargetPointsList, startNavigation }; 