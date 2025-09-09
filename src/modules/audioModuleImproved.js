/**
 * Модуль звуковых сигналов для навигации с простой логикой мажор/минор
 * Использует аккорды: мажорный для приближения, минорный для удаления
 */

// Переменные состояния
let isAudioEnabled = true;
let audioContext = null;
let lastDistance = null;

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
  return audioContext;
}

// Получение базовой частоты в зависимости от расстояния
function getBaseFrequency(distance) {
    const minDistance = 10;
    const maxDistance = 200;
    const minFreq = 200; // Низкий тон для далеко
    const maxFreq = 800; // Высокий тон для близко

    // Нормализуем расстояние от 0 до 1
    const normalizedDistance = 1 - Math.min(1, Math.max(0, (distance - minDistance) / (maxDistance - minDistance)));

    // Вычисляем базовую частоту
    return minFreq + (maxFreq - minFreq) * normalizedDistance;
}

// Создание мажорного аккорда
function createMajorChord(baseFrequency, volume = 0.8) {
    const ctx = initAudioContext();
    if (!ctx || !isAudioEnabled) return;
    
    const frequencies = [
        baseFrequency,                    // Прима
        baseFrequency * Math.pow(2, 4/12), // Большая терция
        baseFrequency * Math.pow(2, 7/12)  // Чистая квинта
    ];
    
    frequencies.forEach(freq => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
    });
}

// Создание минорного аккорда
function createMinorChord(baseFrequency, volume = 0.8) {
    const ctx = initAudioContext();
    if (!ctx || !isAudioEnabled) return;
    
    const frequencies = [
        baseFrequency,                    // Прима
        baseFrequency * Math.pow(2, 3/12), // Малая терция
        baseFrequency * Math.pow(2, 7/12)  // Чистая квинта
    ];
    
    frequencies.forEach(freq => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
    });
}

// Создание звука победы - НАСТОЯЩИЕ ФАНФАРЫ!
function createVictorySound() {
    const ctx = initAudioContext();
    
    // Победная мелодия - восходящая гамма с триумфом
    const victoryMelody = [
        { freq: 261.63, duration: 0.2 },  // До (C4)
        { freq: 293.66, duration: 0.2 },  // Ре (D4)
        { freq: 329.63, duration: 0.2 },  // Ми (E4)
        { freq: 349.23, duration: 0.2 },  // Фа (F4)
        { freq: 392.00, duration: 0.2 },  // Соль (G4)
        { freq: 440.00, duration: 0.2 },  // Ля (A4)
        { freq: 493.88, duration: 0.2 },  // Си (B4)
        { freq: 523.25, duration: 0.4 }   // До октавой (C5) - дольше!
    ];
    
    // Проигрываем мелодию ТРИ РАЗА с нарастающей громкостью
    for (let repeat = 0; repeat < 3; repeat++) {
        const startTime = ctx.currentTime + repeat * 2.0; // 2 секунды между повторами
        let currentTime = startTime;
        
        // Увеличиваем громкость с каждым повтором
        const volume = 0.3 + (repeat * 0.1); // 0.3, 0.4, 0.5
        
        victoryMelody.forEach((note, index) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.frequency.setValueAtTime(note.freq, currentTime);
            oscillator.type = 'sine';
            
            // Громкое нарастание и затухание
            gainNode.gain.setValueAtTime(0, currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(volume, currentTime + note.duration - 0.05);
            gainNode.gain.linearRampToValueAtTime(0, currentTime + note.duration);
            
            oscillator.start(currentTime);
            oscillator.stop(currentTime + note.duration);
            
            currentTime += note.duration;
        });
    }
    
    // ФИНАЛЬНЫЙ ТРИУМФАЛЬНЫЙ АККОРД - МАКСИМАЛЬНО ГРОМКИЙ!
    setTimeout(() => {
        const finalFrequencies = [
            261.63,  // До (C4)
            329.63,  // Ми (E4)
            392.00,  // Соль (G4)
            523.25,  // До октавой (C5)
            659.25,  // Ми октавой (E5)
            783.99   // Соль октавой (G5)
        ];
        const finalTime = ctx.currentTime;
        
        finalFrequencies.forEach(freq => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.frequency.setValueAtTime(freq, finalTime);
            oscillator.type = 'sine';
            
            // МАКСИМАЛЬНАЯ ГРОМКОСТЬ!
            gainNode.gain.setValueAtTime(0, finalTime);
            gainNode.gain.linearRampToValueAtTime(0.4, finalTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0.4, finalTime + 1.5);
            gainNode.gain.linearRampToValueAtTime(0, finalTime + 2.0);
            
            oscillator.start(finalTime);
            oscillator.stop(finalTime + 2.0);
        });
    }, 6000); // После всех трех мелодий
    
    console.log('🏆🎺🎉 ТРИУМФАЛЬНЫЕ ФАНФАРЫ! ПОБЕДА! 🎉🎺🏆');
}

// Основная функция навигации - проигрывает звук в зависимости от расстояния и скорости
export function playNavigationSound(distance, speed) {
    if (!isAudioEnabled) return;
    
    const baseFreq = getBaseFrequency(distance);
    let isApproaching = false;
    
    if (speed > 0.1) {
        isApproaching = true;
    } else if (speed < -0.1) {
        isApproaching = false;
    } else {
        isApproaching = (distance < 100); // Для нейтрального считаем приближением если расстояние < 100
    }
    
    if (isApproaching) {
        createMajorChord(baseFreq, 1.0);
        console.log(`🎵 Мажорный аккорд: ${Math.round(baseFreq)}Hz, расстояние: ${Math.round(distance)}м, скорость: ${speed}`);
    } else {
        createMinorChord(baseFreq, 1.0);
        console.log(`🎵 Минорный аккорд: ${Math.round(baseFreq)}Hz, расстояние: ${Math.round(distance)}м, скорость: ${speed}`);
    }
    
    lastDistance = distance;
}

// Функция для воспроизведения звука победы
export function playVictorySound() {
    if (!isAudioEnabled) return;
    createVictorySound();
}

// Включение/отключение звука
export function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    console.log(`🔊 Звук ${isAudioEnabled ? 'включен' : 'отключен'}`);
    return isAudioEnabled;
}

// Получение статуса звука
export function isAudioOn() {
    return isAudioEnabled;
}

// Получение интервала между звуками в зависимости от расстояния
export function getSoundInterval(distance) {
    const minDistance = 10;
    const maxDistance = 200;
    const minInterval = 0.5; // Чаще для близко
    const maxInterval = 2; // Реже для далеко

    // Нормализуем расстояние от 0 до 1
    const normalizedDistance = Math.min(1, Math.max(0, (distance - minDistance) / (maxDistance - minDistance)));

    // Вычисляем интервал
    return minInterval + (maxInterval - minInterval) * normalizedDistance;
}
