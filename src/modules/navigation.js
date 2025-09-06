/**
 * Модуль звуковой навигации "Горячо-Холодно"
 * Обеспечивает навигацию к целевым точкам через звуковые сигналы
 */

import { haversine } from './utils.js';
import { pointMarkers, getStartPoint } from './mapModule.js';
import { playSoundPattern, playDirectionSound, toggleAudio, isAudioOn } from './audioModule.js';

// Переменные навигации
let isNavigating = false;
let currentTarget = null;
let lastDistance = null;
let navigationInterval = null;
let userPosition = null;
let watchId = null;

// DOM элементы
const targetPointSelect = document.getElementById('targetPointSelect');
const audioNavBtn = document.getElementById('audioNavBtn');
const toggleAudioBtn = document.getElementById('toggleAudioBtn');
const stopNavBtn = document.getElementById('stopNavBtn');
const navStatus = document.getElementById('navStatus');

// Инициализация модуля навигации
export function initNavigation() {
  audioNavBtn.addEventListener('click', startNavigation);
  stopNavBtn.addEventListener('click', stopNavigation);
  toggleAudioBtn.addEventListener('click', toggleAudioHandler);
  
  // Обновляем иконку кнопки звука
  updateAudioButtonIcon();
}

// Обработчик переключения звука
function toggleAudioHandler() {
  const isOn = toggleAudio();
  updateAudioButtonIcon();
  
  // Показываем уведомление о состоянии звука
  const status = isOn ? 'включён' : 'отключён';
  navStatus.textContent = `🔊 Звук ${status}`;
  navStatus.style.color = isOn ? 'green' : 'red';
  
  setTimeout(() => {
    if (!isNavigating) {
      navStatus.textContent = '';
    }
  }, 2000);
}

// Обновление иконки кнопки звука
function updateAudioButtonIcon() {
  const isOn = isAudioOn();
  toggleAudioBtn.textContent = isOn ? '🔊' : '🔇';
  toggleAudioBtn.title = isOn ? 'Отключить звук' : 'Включить звук';
}

// Обновляем список точек после генерации
export function updateTargetPointsList() {
  targetPointSelect.innerHTML = '';
  
  if (pointMarkers.length === 0) {
    targetPointSelect.innerHTML = '<option value="">Сначала сгенерируйте точки</option>';
    targetPointSelect.disabled = true;
    audioNavBtn.disabled = true;
    return;
  }
  
  // Добавляем стартовую точку
  const startPoint = getStartPoint();
  if (startPoint) {
    const option = document.createElement('option');
    option.value = 'start';
    option.textContent = 'СТАРТ';
    targetPointSelect.appendChild(option);
  }
  
  // Добавляем все сгенерированные точки
  pointMarkers.forEach((marker, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Точка ${i + 1}`;
    targetPointSelect.appendChild(option);
  });
  
  targetPointSelect.disabled = false;
  audioNavBtn.disabled = false;
}

// Функция воспроизведения звуковых сигналов с учётом направления
function playNavigationSound(pattern, direction = 'neutral') {
  if (isAudioOn()) {
    playSoundPattern(pattern, direction);
    
    // Дополнительно воспроизводим звук направления, если оно изменилось
    if (direction !== 'neutral') {
      setTimeout(() => {
        playDirectionSound(direction);
      }, 200); // Небольшая задержка после основного сигнала
    }
  }
}

// Получение координат целевой точки
function getTargetCoords() {
  const selectedValue = targetPointSelect.value;
  const startPoint = getStartPoint();
  if (selectedValue === 'start' && startPoint) {
    return { lat: startPoint.lat, lng: startPoint.lng };
  } else if (selectedValue !== '' && pointMarkers[selectedValue]) {
    const marker = pointMarkers[selectedValue];
    return marker.getLatLng();
  }
  return null;
}

// Основная логика навигации
function navigationStep() {
  if (!isNavigating || !userPosition || !currentTarget) return;
  
  const distance = haversine(userPosition.lat, userPosition.lng, currentTarget.lat, currentTarget.lng);
  
  // Определяем направление движения
  let direction = 'neutral';
  let directionText = '';
  
  if (lastDistance !== null) {
    const distanceDiff = distance - lastDistance;
    
    if (distanceDiff < -2) {
      // Приближаемся (расстояние уменьшилось более чем на 2 метра)
      direction = 'approaching';
      directionText = ' ↗️';
    } else if (distanceDiff > 2) {
      // Удаляемся (расстояние увеличилось более чем на 2 метра)
      direction = 'moving_away';
      directionText = ' ↘️';
    }
  }
  
  // Обновляем статус с индикацией направления
  navStatus.textContent = `📍 ${distance.toFixed(0)}м${directionText}`;
  
  // Проверяем достижение цели
  if (distance < 5) {
    playNavigationSound([200, 100, 200, 100, 200], 'neutral'); // Сигнал "цель достигнута"
    navStatus.textContent = '🎯 Цель достигнута!';
    navStatus.style.color = 'green';
    
    // Показываем уведомление
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Рогейн', {
        body: 'Цель достигнута! 🎯',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiM0Q0FGNTAiLz4KPHBhdGggZD0iTTk2IDQ4TDEwOCA2NEwxMjggNzJMMTA4IDgwTDk2IDk2TDg0IDgwTDY0IDcyTDg0IDY0TDk2IDQ4WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==',
        // Звуковой сигнал уже воспроизведён
      });
    }
    
    setTimeout(() => {
      navStatus.style.color = 'black';
    }, 3000);
    return;
  }
  
  // Определяем паттерн звукового сигнала на основе расстояния
  let soundDelay, pattern;
  
  if (distance < 20) {
    // Очень близко - частые звуковые сигналы
    pattern = [100];
    soundDelay = 500;
  } else if (distance < 50) {
    // Очень горячо
    pattern = [50];
    soundDelay = 1000;
  } else if (distance < 100) {
    // Горячо
    pattern = [80];
    soundDelay = 2000;
  } else if (distance < 200) {
    // Тепло
    pattern = [100];
    soundDelay = 3000;
  } else if (distance < 500) {
    // Прохладно
    pattern = [150];
    soundDelay = 5000;
  } else {
    // Холодно
    pattern = [200];
    soundDelay = 10000;
  }
  
  // Дополнительная логика: если отдаляемся, делаем звук длиннее и реже
  if (direction === 'moving_away') {
    pattern = [300]; // Длинный звуковой сигнал при отдалении
    soundDelay = Math.min(soundDelay * 1.5, 15000);
  } else if (direction === 'approaching') {
    // При приближении делаем сигналы чаще
    soundDelay = Math.max(soundDelay * 0.7, 300);
  }
  
  playNavigationSound(pattern, direction);
  lastDistance = distance;
  
  // Планируем следующую проверку
  clearTimeout(navigationInterval);
  navigationInterval = setTimeout(navigationStep, soundDelay);
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
  navStatus.textContent = `❌ Ошибка геолокации: ${error.message}`;
  navStatus.style.color = 'red';
}

// Начало навигации
function startNavigation() {
  const target = getTargetCoords();
  if (!target) {
    alert('Выберите целевую точку!');
    return;
  }
  
  currentTarget = target;
  isNavigating = true;
  lastDistance = null;
  
  // Предотвращаем засыпание экрана
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(lock => {
      console.log('Экран не будет засыпать во время навигации');
    }).catch(err => {
      console.log('Не удалось предотвратить засыпание экрана:', err);
    });
  }
  
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
    
    navStatus.textContent = '🔍 Поиск GPS...';
    navStatus.style.color = 'blue';
    
    audioNavBtn.style.display = 'none';
    stopNavBtn.style.display = 'inline-block';
    
    // Приветственный звуковой сигнал
    playNavigationSound([100, 100, 100], 'neutral');
  } else {
    alert('Геолокация не поддерживается вашим браузером!');
  }
}

// Остановка навигации
function stopNavigation() {
  isNavigating = false;
  
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  
  if (navigationInterval) {
    clearTimeout(navigationInterval);
    navigationInterval = null;
  }
  
  navStatus.textContent = '';
  audioNavBtn.style.display = 'inline-block';
  stopNavBtn.style.display = 'none';
  
  // Финальный звуковой сигнал
  playNavigationSound([200], 'neutral');
}

// Экспорт функций для внешнего использования
export { isNavigating, currentTarget, userPosition }; 