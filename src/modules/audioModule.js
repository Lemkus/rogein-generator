/**
 * Модуль звуковых сигналов для навигации
 * Обеспечивает звуковую навигацию "Горячо-Холодно"
 */

// Создаём аудио контекст для генерации звуков
let audioContext = null;
let isAudioEnabled = true;

// Инициализация аудио контекста
function initAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.error('Ошибка инициализации аудио контекста:', error);
      isAudioEnabled = false;
    }
  }
}

// Генерация тона заданной частоты и длительности
function generateTone(frequency, duration, volume = 0.3) {
  if (!isAudioEnabled || !audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// Воспроизведение звукового паттерна с учётом направления
export function playSoundPattern(pattern, direction = 'neutral') {
  if (!isAudioEnabled) {
    console.log('Звук отключен:', pattern, direction);
    return;
  }
  
  initAudioContext();
  
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  // Определяем частоты для разных типов сигналов
  const frequencies = {
    close: 800,      // Высокий тон - очень близко
    hot: 600,        // Средне-высокий - горячо
    warm: 400,       // Средний - тепло
    cool: 300,       // Средне-низкий - прохладно
    cold: 200,       // Низкий - холодно
    target: 1000     // Очень высокий - цель достигнута
  };
  
  // Определяем тип сигнала по длительности паттерна
  let frequency;
  if (pattern.length === 1) {
    const duration = pattern[0];
    if (duration <= 100) frequency = frequencies.close;
    else if (duration <= 150) frequency = frequencies.hot;
    else if (duration <= 200) frequency = frequencies.warm;
    else frequency = frequencies.cold;
  } else {
    // Сложный паттерн - цель достигнута
    frequency = frequencies.target;
  }
  
  // Модифицируем частоту в зависимости от направления
  if (direction === 'approaching') {
    // При приближении - повышаем тон (более позитивный звук)
    frequency *= 1.1;
  } else if (direction === 'moving_away') {
    // При удалении - понижаем тон (более негативный звук)
    frequency *= 0.9;
  }
  
  // Воспроизводим паттерн с модификацией для направления
  let currentTime = audioContext.currentTime;
  
  for (let i = 0; i < pattern.length; i++) {
    const duration = pattern[i] / 1000; // Конвертируем в секунды
    
    // Для удаления добавляем эффект "затухания"
    let volume = 0.2;
    if (direction === 'moving_away') {
      volume *= 0.7; // Тише при удалении
    } else if (direction === 'approaching') {
      volume *= 1.2; // Громче при приближении
    }
    
    generateTone(frequency, duration, Math.min(volume, 0.3));
    
    // Добавляем паузу между сигналами (если есть)
    if (i < pattern.length - 1) {
      currentTime += duration + 0.1; // 100мс пауза
    }
  }
}

// Специальные звуки для направления движения
export function playDirectionSound(direction) {
  if (!isAudioEnabled) return;
  
  initAudioContext();
  
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  let pattern, frequency;
  
  if (direction === 'approaching') {
    // Восходящий тон при приближении (позитивный сигнал)
    pattern = [150, 100, 100]; // Короткие сигналы
    frequency = 600;
  } else if (direction === 'moving_away') {
    // Нисходящий тон при удалении (негативный сигнал)
    pattern = [200, 150, 200]; // Длинные сигналы
    frequency = 300;
  } else {
    return; // Нейтральное направление - не воспроизводим дополнительный звук
  }
  
  // Воспроизводим паттерн с изменяющейся частотой
  let currentTime = audioContext.currentTime;
  
  for (let i = 0; i < pattern.length; i++) {
    const duration = pattern[i] / 1000;
    let currentFreq = frequency;
    
    if (direction === 'approaching') {
      // При приближении - повышаем частоту с каждым сигналом
      currentFreq = frequency * (1 + i * 0.1);
    } else if (direction === 'moving_away') {
      // При удалении - понижаем частоту с каждым сигналом
      currentFreq = frequency * (1 - i * 0.1);
    }
    
    generateTone(currentFreq, duration, 0.15);
    currentTime += duration + 0.05; // Короткие паузы между сигналами
  }
}

// Включение/отключение звука
export function toggleAudio() {
  isAudioEnabled = !isAudioEnabled;
  return isAudioEnabled;
}

// Получение статуса звука
export function isAudioOn() {
  return isAudioEnabled;
}

// Установка громкости (0.0 - 1.0)
export function setVolume(volume) {
  if (audioContext) {
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  }
}
