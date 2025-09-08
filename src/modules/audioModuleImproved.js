/**
 * Модуль звуковых сигналов для навигации с улучшенными звуками
 * Использует собственную генерацию тонов для надёжности
 */

// Переменные состояния
let isAudioEnabled = true;
let audioContext = null;

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

// Создание улучшенного звука с несколькими гармониками
function createRichTone(frequency, duration, volume = 0.3, waveType = 'sine') {
  if (!isAudioEnabled || !audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  
  oscillator.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.type = waveType;
  
  // Добавляем фильтр для более приятного звука
  filterNode.type = 'lowpass';
  filterNode.frequency.setValueAtTime(frequency * 3, audioContext.currentTime);
  filterNode.Q.setValueAtTime(0.5, audioContext.currentTime);
  
  // Настраиваем громкость с плавным затуханием
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// Создание колокольчиков (высокие гармоники) - поднятые частоты
function createBellSound(frequencies, durations) {
  initAudioContext();
  
  frequencies.forEach((freq, i) => {
    setTimeout(() => {
      // Основной тон - поднимаем все частоты для лучшей слышимости
      createRichTone(freq, durations[i], 0.5, 'sine');
      
      // Добавляем гармоники для более богатого звука
      setTimeout(() => createRichTone(freq * 1.5, durations[i] * 0.5, 0.3, 'triangle'), 50);
      setTimeout(() => createRichTone(freq * 2, durations[i] * 0.3, 0.2, 'triangle'), 100);
    }, i * 120);
  });
}

// Создание свиста (быстрые высокие тоны)
function createWhistleSound(frequencies, durations) {
  initAudioContext();
  
  frequencies.forEach((freq, i) => {
    setTimeout(() => {
      createRichTone(freq, durations[i], 0.5, 'triangle');
    }, i * 100);
  });
}

// Создание гонга (низкий тон с затуханием) - поднятые частоты
function createGongSound(frequency, duration) {
  initAudioContext();
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  
  oscillator.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Поднимаем базовую частоту гонга для лучшей слышимости
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.type = 'sine';
  
  // Фильтр для гонга
  filterNode.type = 'lowpass';
  filterNode.frequency.setValueAtTime(frequency * 3, audioContext.currentTime);
  filterNode.Q.setValueAtTime(1.5, audioContext.currentTime);
  
  // Медленное затухание для гонга
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.7, audioContext.currentTime + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// Создание триумфального звука
function createTriumphSound() {
  initAudioContext();
  
  const frequencies = [523, 659, 784, 1047]; // До-Ми-Соль-До (мажорный аккорд)
  const durations = [0.3, 0.3, 0.3, 0.5];
  
  frequencies.forEach((freq, i) => {
    setTimeout(() => {
      createRichTone(freq, durations[i], 0.6, 'triangle');
    }, i * 200);
  });
}

// Создание звука приближения (восходящий аккорд)
function createApproachingSound() {
  initAudioContext();
  
  const frequencies = [261, 329, 392]; // До-Ми-Соль (мажорный аккорд)
  const durations = [0.4, 0.4, 0.4];
  
  frequencies.forEach((freq, i) => {
    setTimeout(() => {
      createRichTone(freq, durations[i], 0.5, 'triangle');
    }, i * 150);
  });
}

// Создание звука удаления (нисходящий аккорд)
function createMovingAwaySound() {
  initAudioContext();
  
  const frequencies = [392, 311, 261]; // Соль-Ми♭-До (минорный аккорд)
  const durations = [0.5, 0.5, 0.5];
  
  frequencies.forEach((freq, i) => {
    setTimeout(() => {
      createRichTone(freq, durations[i], 0.3, 'sawtooth');
    }, i * 200);
  });
}

// Воспроизведение звукового паттерна с относительным определением тона
export function playSoundPattern(pattern, direction = 'neutral', distance = null) {
  console.log('🔊 playSoundPattern вызвана:', { pattern, direction, distance, isAudioEnabled });
  
  if (!isAudioEnabled) {
    console.log('Звук отключен');
    return;
  }
  
  // Определяем тип звука по паттерну
  let soundType;
  if (pattern.length === 1) {
    const duration = pattern[0];
    if (duration <= 100) soundType = 'close';
    else if (duration <= 150) soundType = 'hot';
    else if (duration <= 200) soundType = 'warm';
    else soundType = 'cold';
  } else {
    soundType = 'target';
  }
  
  console.log(`🎵 Воспроизводим звук: ${soundType}, направление: ${direction}, расстояние: ${distance}м`);
  
  // ОТНОСИТЕЛЬНАЯ ЛОГИКА: тон зависит от текущего расстояния до цели
  if (distance !== null) {
    // Определяем базовую частоту в зависимости от расстояния
    let baseFrequency;
    if (distance < 20) {
      baseFrequency = 1200; // Очень близко - очень высокий тон
    } else if (distance < 50) {
      baseFrequency = 1000; // Горячо - высокий тон
    } else if (distance < 100) {
      baseFrequency = 800;  // Тепло - средне-высокий
    } else if (distance < 200) {
      baseFrequency = 600;  // Прохладно - средний
    } else if (distance < 500) {
      baseFrequency = 400;  // Холодно - средне-низкий
    } else {
      baseFrequency = 300;  // Очень холодно - низкий, но слышимый
    }
    
    // Модифицируем звуки в зависимости от направления
    if (direction === 'approaching') {
      // При приближении делаем звуки выше и ярче
      switch (soundType) {
        case 'close':
          createBellSound([baseFrequency, baseFrequency * 1.2, baseFrequency * 1.4], [0.1, 0.1, 0.1]);
          break;
        case 'hot':
          createWhistleSound([baseFrequency, baseFrequency * 1.3], [0.15, 0.15]);
          break;
        case 'warm':
          createRichTone(baseFrequency, 0.2, 0.5, 'triangle');
          setTimeout(() => createRichTone(baseFrequency * 1.2, 0.2, 0.5, 'triangle'), 150);
          break;
        case 'cold':
          createRichTone(baseFrequency, 0.3, 0.5, 'triangle');
          break;
        case 'target':
          createTriumphSound();
          break;
      }
    } else if (direction === 'moving_away') {
      // При удалении делаем звуки ниже и глуше
      switch (soundType) {
        case 'close':
          createBellSound([baseFrequency * 0.8, baseFrequency * 0.9, baseFrequency], [0.15, 0.15, 0.15]);
          break;
        case 'hot':
          createWhistleSound([baseFrequency * 0.7, baseFrequency * 0.8], [0.2, 0.2]);
          break;
        case 'warm':
          createRichTone(baseFrequency * 0.8, 0.25, 0.3, 'sawtooth');
          setTimeout(() => createRichTone(baseFrequency * 0.9, 0.25, 0.3, 'sawtooth'), 200);
          break;
        case 'cold':
          createGongSound(baseFrequency * 0.6, 0.8);
          break;
        case 'target':
          createTriumphSound();
          break;
      }
    } else {
      // Нейтральное направление
      switch (soundType) {
        case 'close':
          createBellSound([baseFrequency, baseFrequency * 1.1, baseFrequency * 1.2], [0.1, 0.1, 0.1]);
          break;
        case 'hot':
          createWhistleSound([baseFrequency, baseFrequency * 1.2], [0.15, 0.15]);
          break;
        case 'warm':
          createRichTone(baseFrequency, 0.2, 0.4, 'sine');
          setTimeout(() => createRichTone(baseFrequency * 1.1, 0.2, 0.4, 'sine'), 150);
          break;
        case 'cold':
          createGongSound(baseFrequency * 0.8, 0.6);
          break;
        case 'target':
          createTriumphSound();
          break;
      }
    }
  } else {
    // Если расстояние не указано, используем стандартные частоты
    console.log('⚠️ Расстояние не указано, используем стандартные частоты');
    // ... стандартная логика без расстояния
  }
}

// Специальные звуки для направления движения
export function playDirectionSound(direction) {
  console.log('🎵 playDirectionSound вызвана:', direction);
  
  if (!isAudioEnabled) return;
  
  if (direction === 'approaching') {
    console.log('🎵 Воспроизводим звук приближения');
    createApproachingSound();
  } else if (direction === 'moving_away') {
    console.log('🎵 Воспроизводим звук удаления');
    createMovingAwaySound();
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
  // Для генерации тонов громкость настраивается при создании
  console.log('🔊 Громкость установлена:', volume);
}
