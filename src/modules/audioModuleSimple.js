/**
 * Простой модуль звуковой навигации без Tone.js
 * Использует Web Audio API напрямую для максимальной стабильности
 */

// Переменные состояния
let isAudioEnabled = true;
let currentFrequency = 200;
let frequencyProgress = 0;
let startDistance = null;
let lastDistance = null;
let lastSpeed = 0;
let isPlaying = false;

// Константы частот
const minFreq = 200;
const maxFreq = 800;

// Глобальные аудио объекты
let audioContext = null;
let gainNode = null;
let oscillator = null;

// Инициализация Web Audio API
function initAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            gainNode.gain.value = 0.3; // Умеренная громкость
        } catch (error) {
            console.error('Ошибка инициализации Web Audio API:', error);
            return false;
        }
    }
    
    // Возобновляем контекст если приостановлен
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    return true;
}

// Остановка текущего звука
function stopCurrentSound() {
    if (oscillator) {
        try {
            oscillator.stop();
            oscillator.disconnect();
        } catch (e) {
            // Игнорируем ошибки при остановке
        }
        oscillator = null;
    }
    isPlaying = false;
}

// Воспроизведение простого тона
function playTone(frequency, duration = 0.3, type = 'sine') {
    if (!initAudioContext() || !isAudioEnabled || isPlaying) {
        return;
    }
    
    // Останавливаем предыдущий звук
    stopCurrentSound();
    
    try {
        oscillator = audioContext.createOscillator();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        
        oscillator.connect(gainNode);
        
        // Плавное нарастание и затухание
        const now = audioContext.currentTime;
        oscillator.start(now);
        oscillator.stop(now + duration);
        
        isPlaying = true;
        
        // Сбрасываем флаг после завершения
        setTimeout(() => {
            isPlaying = false;
        }, duration * 1000 + 100);
        
    } catch (error) {
        console.warn('Ошибка воспроизведения звука:', error);
        isPlaying = false;
    }
}

// Воспроизведение аккорда (два тона одновременно)
function playChord(frequency1, frequency2, duration = 0.4, type = 'sine') {
    if (!initAudioContext() || !isAudioEnabled || isPlaying) {
        return;
    }
    
    stopCurrentSound();
    
    try {
        const now = audioContext.currentTime;
        
        // Первый тон
        const osc1 = audioContext.createOscillator();
        osc1.type = type;
        osc1.frequency.value = frequency1;
        
        // Второй тон
        const osc2 = audioContext.createOscillator();
        osc2.type = type;
        osc2.frequency.value = frequency2;
        
        // Создаем отдельный gain для аккорда
        const chordGain = audioContext.createGain();
        chordGain.gain.value = 0.2; // Тише для аккорда
        chordGain.connect(gainNode);
        
        osc1.connect(chordGain);
        osc2.connect(chordGain);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
        
        isPlaying = true;
        
        // Очистка после завершения
        setTimeout(() => {
            try {
                osc1.disconnect();
                osc2.disconnect();
                chordGain.disconnect();
            } catch (e) {
                // Игнорируем ошибки очистки
            }
            isPlaying = false;
        }, duration * 1000 + 100);
        
    } catch (error) {
        console.warn('Ошибка воспроизведения аккорда:', error);
        isPlaying = false;
    }
}

// Получение прогресса частоты
function getTargetFrequencyProgress(distance) {
    if (startDistance === null) {
        startDistance = distance;
        return 0;
    }
    
    if (distance <= 10) {
        return 1;
    }
    
    const progress = (startDistance - distance) / startDistance;
    return Math.max(0, Math.min(1, progress));
}

// Основная функция навигации
export function playNavigationSound(distance, speed) {
    if (!isAudioEnabled || isPlaying) {
        return;
    }
    
    // Определяем направление движения
    let isApproaching = false;
    if (lastDistance !== null && speed !== undefined) {
        isApproaching = speed > 0;
    }
    
    // Получаем прогресс
    const targetProgress = getTargetFrequencyProgress(distance);
    frequencyProgress = targetProgress;
    
    // Вычисляем частоту
    currentFrequency = minFreq + (maxFreq - minFreq) * frequencyProgress;
    
    // Проигрываем звук в зависимости от направления
    if (isApproaching) {
        // Приближение - мажорный аккорд (яркий, позитивный)
        const majorThird = currentFrequency * Math.pow(2, 4/12);
        playChord(currentFrequency, majorThird, 0.3, 'triangle');
    } else {
        // Удаление - минорный аккорд (глухой, предупреждающий)
        const minorThird = currentFrequency * Math.pow(2, 3/12);
        playChord(currentFrequency, minorThird, 0.4, 'sawtooth');
    }
    
    lastDistance = distance;
    lastSpeed = speed;
}

// Звук победы
export function playVictorySound() {
    if (!isAudioEnabled || isPlaying) {
        return;
    }
    
    stopCurrentSound();
    
    try {
        // Простая мелодия победы
        const melody = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        
        melody.forEach((freq, index) => {
            setTimeout(() => {
                if (index === melody.length - 1) {
                    // Последняя нота - аккорд
                    playChord(freq, freq * 1.25, 0.8, 'triangle');
                } else {
                    playTone(freq, 0.3, 'triangle');
                }
            }, index * 300);
        });
        
    } catch (error) {
        console.warn('Ошибка воспроизведения звука победы:', error);
    }
}

// Получение интервала между звуками
export function getSoundInterval(distance) {
    if (startDistance === null) {
        return 3.0;
    }
    
    if (distance <= 10) {
        return 0.2;
    }
    
    const progress = (startDistance - distance) / startDistance;
    const clampedProgress = Math.max(0, Math.min(1, progress));
    
    const minInterval = 0.2;
    const maxInterval = 3.0;
    const interval = maxInterval - (maxInterval - minInterval) * clampedProgress;
    
    return interval;
}

// Включение/отключение звука
export function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    
    if (!isAudioEnabled) {
        stopCurrentSound();
    }
    
    return isAudioEnabled;
}

// Получение статуса звука
export function isAudioOn() {
    return isAudioEnabled;
}

// Сброс состояния навигации
export function resetNavigation() {
    startDistance = null;
    frequencyProgress = 0;
    lastDistance = null;
    lastSpeed = null;
    stopCurrentSound();
}

// Функции для отладочной страницы (заглушки)
export function startMovementSimulation(initialDistance, speed, callback) {
    console.log('Симуляция движения не реализована в простом модуле');
}

export function stopMovementSimulation() {
    console.log('Остановка симуляции не реализована в простом модуле');
}

export function getSimulationStatus() {
    return { isRunning: false, distance: 0, speed: 0 };
}