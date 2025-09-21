/**
 * Модуль звуковой навигации "Горячо-Холодно"
 * Обеспечивает навигацию к целевым точкам через звуковые сигналы
 */

import { haversine } from './utils.js';
import { pointMarkers, getStartPoint } from './mapModule.js';
import { playNavigationSound, playVictorySound, toggleAudio, isAudioOn, getSoundInterval, resetNavigation } from './audioModuleSimple.js';

// Переменные навигации
let isNavigating = false;
let currentTarget = null;
let lastDistance = null;
let navigationInterval = null;
let userPosition = null;
let watchId = null;

// Переменные для улучшенной навигации
let distanceHistory = []; // История расстояний для стабилизации
let directionHistory = []; // История направлений
const MAX_HISTORY_SIZE = 5; // Максимальный размер истории
const ACCURACY_ZONE_DISTANCE = 25; // Зона неопределенности (метры)
const CRITICAL_ZONE_DISTANCE = 15; // Критическая зона (метры)

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
  if (selectedValue === 'start' && startPoint) {
    console.log(`🎯 Используем стартовую точку: ${startPoint.lat.toFixed(6)}, ${startPoint.lng.toFixed(6)}`);
    return { lat: startPoint.lat, lng: startPoint.lng };
  } else if (selectedValue !== '' && pointMarkers[selectedValue]) {
    const marker = pointMarkers[selectedValue];
    const coords = marker.getLatLng();
    console.log(`🎯 Используем точку ${selectedValue}: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    return coords;
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
  navStatus.textContent = statusText;
  
  // Устанавливаем цвет в зависимости от зоны
  if (distance < 10) {
    navStatus.style.color = 'green';
  } else if (distance < CRITICAL_ZONE_DISTANCE) {
    navStatus.style.color = 'red';
  } else if (distance < ACCURACY_ZONE_DISTANCE) {
    navStatus.style.color = 'orange';
  } else {
    navStatus.style.color = 'black';
  }
  
  // Проверяем достижение цели
  if (distance < 10) {
    playVictorySound(); // Звук победы
    navStatus.textContent = '🎯 ЦЕЛЬ ДОСТИГНУТА!';
    navStatus.style.color = 'green';
    
    // Показываем уведомление
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Рогейн', {
        body: 'Цель достигнута! 🎯',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiByeD0iMjQiIGZpbGw9IiM0Q0FGNTAiLz4KPHBhdGggZD0iTTk2IDQ4TDEwOCA2NEwxMjggNzJMMTA4IDgwTDk2IDk2TDg0IDgwTDY0IDcyTDg0IDY0TDk2IDQ4WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==',
      });
    }
    
    setTimeout(() => {
      navStatus.style.color = 'black';
    }, 3000);
    return;
  }
  
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
  
  // Очищаем историю для новой навигации
  distanceHistory = [];
  directionHistory = [];
  
  // Сбрасываем состояние аудио модуля для новой навигации
  resetNavigation();
  
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
    playNavigationSound(100, 0); // Расстояние 100м, скорость 0
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
    clearInterval(navigationInterval);
    navigationInterval = null;
  }
  
  navStatus.textContent = '';
  audioNavBtn.style.display = 'inline-block';
  stopNavBtn.style.display = 'none';
  
  // Финальный звуковой сигнал
  playNavigationSound(200, 0); // Расстояние 200м, скорость 0
}


// Экспорт функций для внешнего использования
export { isNavigating, currentTarget, userPosition }; 