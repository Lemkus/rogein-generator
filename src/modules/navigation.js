/**
 * Модуль вибро-навигации "Горячо-Холодно"
 * Обеспечивает навигацию к целевым точкам через вибрацию
 */

import { haversine } from './utils.js';
import { pointMarkers, getStartPoint } from './mapModule.js';

// Переменные навигации
let isNavigating = false;
let currentTarget = null;
let lastDistance = null;
let navigationInterval = null;
let userPosition = null;
let watchId = null;

// DOM элементы
const targetPointSelect = document.getElementById('targetPointSelect');
const vibroNavBtn = document.getElementById('vibroNavBtn');
const stopNavBtn = document.getElementById('stopNavBtn');
const navStatus = document.getElementById('navStatus');

// Инициализация модуля навигации
export function initNavigation() {
  vibroNavBtn.addEventListener('click', startNavigation);
  stopNavBtn.addEventListener('click', stopNavigation);
}

// Обновляем список точек после генерации
export function updateTargetPointsList() {
  targetPointSelect.innerHTML = '';
  
  if (pointMarkers.length === 0) {
    targetPointSelect.innerHTML = '<option value="">Сначала сгенерируйте точки</option>';
    targetPointSelect.disabled = true;
    vibroNavBtn.disabled = true;
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
  vibroNavBtn.disabled = false;
}

// Функция вибрации с разными паттернами
function vibratePattern(pattern) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  } else {
    console.log('Вибрация не поддерживается:', pattern);
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
  
  // Обновляем статус
  navStatus.textContent = `📍 ${distance.toFixed(0)}м`;
  
  // Проверяем достижение цели
  if (distance < 5) {
    vibratePattern([200, 100, 200, 100, 200]); // Сигнал "цель достигнута"
    navStatus.textContent = '🎯 Цель достигнута!';
    navStatus.style.color = 'green';
    setTimeout(() => {
      navStatus.style.color = 'black';
    }, 3000);
    return;
  }
  
  // Определяем паттерн вибрации на основе расстояния
  let vibrateDelay, pattern;
  
  if (distance < 20) {
    // Очень близко - непрерывная вибрация
    pattern = [100];
    vibrateDelay = 500;
  } else if (distance < 50) {
    // Очень горячо
    pattern = [50];
    vibrateDelay = 1000;
  } else if (distance < 100) {
    // Горячо
    pattern = [80];
    vibrateDelay = 2000;
  } else if (distance < 200) {
    // Тепло
    pattern = [100];
    vibrateDelay = 3000;
  } else if (distance < 500) {
    // Прохладно
    pattern = [150];
    vibrateDelay = 5000;
  } else {
    // Холодно
    pattern = [200];
    vibrateDelay = 10000;
  }
  
  // Дополнительная логика: если отдаляемся, делаем вибрацию длиннее и реже
  if (lastDistance !== null && distance > lastDistance + 2) {
    pattern = [300]; // Длинная вибрация при отдалении
    vibrateDelay = Math.min(vibrateDelay * 1.5, 15000);
  }
  
  vibratePattern(pattern);
  lastDistance = distance;
  
  // Планируем следующую проверку
  clearTimeout(navigationInterval);
  navigationInterval = setTimeout(navigationStep, vibrateDelay);
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
    
    vibroNavBtn.style.display = 'none';
    stopNavBtn.style.display = 'inline-block';
    
    // Приветственная вибрация
    vibratePattern([100, 100, 100]);
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
  vibroNavBtn.style.display = 'inline-block';
  stopNavBtn.style.display = 'none';
  
  // Финальная вибрация
  vibratePattern([200]);
}

// Экспорт функций для внешнего использования
export { isNavigating, currentTarget, userPosition }; 