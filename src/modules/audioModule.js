/**
 * Модуль звуковых сигналов для навигации
 * Обеспечивает звуковую навигацию "Горячо-Холодно" с приятными звуками
 */

// Создаём аудио контекст для генерации звуков
let audioContext = null;
let isAudioEnabled = true;

// Музыкальные ноты и их частоты
const MUSICAL_NOTES = {
  // Мажорная гамма (приятные звуки)
  C4: 261.63,   // До
  D4: 293.66,   // Ре
  E4: 329.63,   // Ми
  F4: 349.23,   // Фа
  G4: 392.00,   // Соль
  A4: 440.00,   // Ля
  B4: 493.88,   // Си
  C5: 523.25,   // До октавой выше
  
  // Минорная гамма (для удаления)
  Cm4: 261.63,  // До минор
  Dm4: 293.66,  // Ре минор
  Em4: 311.13,  // Ми минор
  Fm4: 349.23,  // Фа минор
  Gm4: 392.00,  // Соль минор
  Am4: 440.00,  // Ля минор
  Bm4: 466.16,  // Си минор
};

// Звуковые паттерны для разных расстояний
const SOUND_PATTERNS = {
  close: {
    notes: [MUSICAL_NOTES.C5, MUSICAL_NOTES.E4, MUSICAL_NOTES.G4], // Мажорный аккорд
    durations: [0.1, 0.1, 0.1],
    intervals: [0.05, 0.05],
    description: "Колокольчики - очень близко"
  },
  hot: {
    notes: [MUSICAL_NOTES.G4, MUSICAL_NOTES.B4],
    durations: [0.15, 0.15],
    intervals: [0.1],
    description: "Свист - горячо"
  },
  warm: {
    notes: [MUSICAL_NOTES.E4, MUSICAL_NOTES.A4],
    durations: [0.2, 0.2],
    intervals: [0.15],
    description: "Двойной сигнал - тепло"
  },
  cool: {
    notes: [MUSICAL_NOTES.C4, MUSICAL_NOTES.F4],
    durations: [0.25, 0.25],
    intervals: [0.2],
    description: "Низкие ноты - прохладно"
  },
  cold: {
    notes: [MUSICAL_NOTES.C4],
    durations: [0.3],
    intervals: [],
    description: "Одиночный низкий тон - холодно"
  },
  target: {
    notes: [MUSICAL_NOTES.C5, MUSICAL_NOTES.E4, MUSICAL_NOTES.G4, MUSICAL_NOTES.C5],
    durations: [0.2, 0.15, 0.15, 0.3],
    intervals: [0.1, 0.1, 0.1],
    description: "Триумфальный аккорд - цель достигнута!"
  }
};

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

// Генерация музыкального тона с улучшенным звучанием
function generateMusicalTone(frequency, duration, volume = 0.3, waveType = 'sine') {
  if (!isAudioEnabled || !audioContext) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const filterNode = audioContext.createBiquadFilter();
  
  // Создаём цепочку: oscillator -> filter -> gain -> destination
  oscillator.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Настраиваем осциллятор
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.type = waveType;
  
  // Добавляем фильтр для более приятного звука
  filterNode.type = 'lowpass';
  filterNode.frequency.setValueAtTime(frequency * 2, audioContext.currentTime);
  filterNode.Q.setValueAtTime(1, audioContext.currentTime);
  
  // Настраиваем громкость с плавным затуханием
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// Воспроизведение музыкального паттерна
function playMusicalPattern(pattern, direction = 'neutral', distance = null) {
  if (!isAudioEnabled) {
    console.log('Звук отключен:', pattern.description, direction, distance);
    return;
  }
  
  initAudioContext();
  
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  console.log('🎵 Воспроизводим:', pattern.description, 'направление:', direction);
  
  let currentTime = audioContext.currentTime;
  
  // Воспроизводим ноты паттерна
  for (let i = 0; i < pattern.notes.length; i++) {
    let frequency = pattern.notes[i];
    let duration = pattern.durations[i];
    let volume = 0.3;
    
    // Модифицируем звук в зависимости от направления
    if (direction === 'approaching') {
      // При приближении - повышаем тон и делаем звук ярче
      frequency *= 1.1;
      volume = 0.4;
      // Используем треугольную волну для более мягкого звука
      generateMusicalTone(frequency, duration, volume, 'triangle');
    } else if (direction === 'moving_away') {
      // При удалении - понижаем тон и делаем звук глуше
      frequency *= 0.9;
      volume = 0.2;
      // Используем пилообразную волну для более резкого звука
      generateMusicalTone(frequency, duration, volume, 'sawtooth');
    } else {
      // Нейтральное направление - стандартный звук
      generateMusicalTone(frequency, duration, volume, 'sine');
    }
    
    console.log(`🎵 Нота ${i+1}: ${frequency.toFixed(0)} Гц, ${duration}с`);
    
    // Добавляем интервал между нотами
    if (i < pattern.intervals.length) {
      currentTime += duration + pattern.intervals[i];
    }
  }
}

// Воспроизведение звукового паттерна с учётом направления и прогрессивного изменения
export function playSoundPattern(pattern, direction = 'neutral', distance = null) {
  console.log('🔊 playSoundPattern вызвана:', { pattern, direction, distance, isAudioEnabled });
  
  if (!isAudioEnabled) {
    console.log('Звук отключен:', pattern, direction, distance);
    return;
  }
  
  initAudioContext();
  
  if (audioContext.state === 'suspended') {
    audioContext.resume();
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
  
  // Получаем музыкальный паттерн
  const musicalPattern = SOUND_PATTERNS[soundType];
  
  // Прогрессивное изменение в зависимости от расстояния
  if (distance !== null) {
    const step = Math.max(distance / 10, 10);
    const steps = Math.floor(distance / step);
    
    // Чем ближе к цели, тем выше ноты
    musicalPattern.notes = musicalPattern.notes.map(note => 
      note * (1 + steps * 0.05) // +5% за каждый шаг приближения
    );
  }
  
  // Воспроизводим музыкальный паттерн
  playMusicalPattern(musicalPattern, direction, distance);
}

// Специальные звуки для направления движения - музыкальные аккорды
export function playDirectionSound(direction) {
  console.log('🎵 playDirectionSound вызвана:', direction);
  
  if (!isAudioEnabled) return;
  
  initAudioContext();
  
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  if (direction === 'approaching') {
    // Приближение - радостный мажорный аккорд (До-Ми-Соль)
    const frequencies = [MUSICAL_NOTES.C4, MUSICAL_NOTES.E4, MUSICAL_NOTES.G4];
    const durations = [0.3, 0.3, 0.3];
    
    console.log('🎵 Приближение: мажорный аккорд', frequencies);
    
    let currentTime = audioContext.currentTime;
    frequencies.forEach((freq, i) => {
      generateMusicalTone(freq, durations[i], 0.3, 'triangle');
      currentTime += durations[i] + 0.05;
    });
    
  } else if (direction === 'moving_away') {
    // Удаление - грустный минорный аккорд (До-Ми♭-Соль)
    const frequencies = [MUSICAL_NOTES.C4, MUSICAL_NOTES.Em4, MUSICAL_NOTES.G4];
    const durations = [0.4, 0.4, 0.4];
    
    console.log('🎵 Удаление: минорный аккорд', frequencies);
    
    let currentTime = audioContext.currentTime;
    frequencies.forEach((freq, i) => {
      generateMusicalTone(freq, durations[i], 0.2, 'sawtooth');
      currentTime += durations[i] + 0.1;
    });
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
