/**
 * Модуль управления медиа-сессией
 * Автоматически приостанавливает/возобновляет музыку при навигации
 */

// Состояние
let isMusicPaused = false;
let wasPlayingBeforeNavigation = false;
let isNavigationActive = false;

/**
 * Инициализация Media Session API
 */
export function initMediaSession() {
  // Проверяем поддержку Media Session API
  if (!('mediaSession' in navigator)) {
    console.log('⚠️ Media Session API не поддерживается');
    return false;
  }

  // Настраиваем обработчики действий
  navigator.mediaSession.setActionHandler('play', () => {
    console.log('▶️ Воспроизведение музыки');
    isMusicPaused = false;
    updatePlaybackState();
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    console.log('⏸️ Пауза музыки');
    isMusicPaused = true;
    updatePlaybackState();
  });

  // Устанавливаем начальное состояние
  updatePlaybackState();
  
  console.log('✅ Media Session API инициализирован');
  return true;
}

/**
 * Обработка изменения расстояния до точки
 */
export function handleDistanceChange(distance) {
  const DUCKING_DISTANCE = 100; // Метры
  
  if (distance < DUCKING_DISTANCE && !isNavigationActive) {
    // Приближаемся к точке - приостанавливаем музыку
    pauseMusicForNavigation();
  } else if (distance >= DUCKING_DISTANCE && isNavigationActive) {
    // Удаляемся от точки - возобновляем музыку
    resumeMusicAfterNavigation();
  }
}

/**
 * Приостановка музыки для навигации
 */
function pauseMusicForNavigation() {
  if (isNavigationActive) return;
  
  console.log('🎯 Приближение к точке - приостанавливаем музыку');
  isNavigationActive = true;
  
  // Сохраняем состояние музыки
  wasPlayingBeforeNavigation = !isMusicPaused;
  
  // Приостанавливаем музыку
  if (!isMusicPaused) {
    isMusicPaused = true;
    updatePlaybackState();
    
    // Показываем уведомление
    showNavigationNotification('🎯 Приближаетесь к точке', 'Музыка приостановлена для навигации');
  }
}

/**
 * Возобновление музыки после навигации
 */
function resumeMusicAfterNavigation() {
  if (!isNavigationActive) return;
  
  console.log('🎯 Удаление от точки - возобновляем музыку');
  isNavigationActive = false;
  
  // Возобновляем музыку, если она играла до навигации
  if (wasPlayingBeforeNavigation) {
    isMusicPaused = false;
    updatePlaybackState();
    
    // Показываем уведомление
    showNavigationNotification('🎵 Музыка возобновлена', 'Навигация завершена');
  }
}

/**
 * Обновление состояния воспроизведения
 */
function updatePlaybackState() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isMusicPaused ? 'paused' : 'playing';
  }
}

/**
 * Показ уведомления о навигации
 */
function showNavigationNotification(title, message) {
  // Проверяем поддержку уведомлений
  if (!('Notification' in window)) {
    console.log(`🔔 ${title}: ${message}`);
    return;
  }

  // Показываем уведомление
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/favicon.svg',
      tag: 'navigation-media'
    });
  } else if (Notification.permission !== 'denied') {
    // Запрашиваем разрешение
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: '/favicon.svg',
          tag: 'navigation-media'
        });
      }
    });
  }
}

/**
 * Принудительная остановка навигации
 */
export function stopNavigation() {
  if (isNavigationActive) {
    resumeMusicAfterNavigation();
  }
}

/**
 * Получение состояния навигации
 */
export function isNavigationModeActive() {
  return isNavigationActive;
}

/**
 * Получение состояния музыки
 */
export function isMusicCurrentlyPaused() {
  return isMusicPaused;
}
