/**
 * Продвинутый модуль звуковой навигации с умным определением направления
 * Исправляет проблемы ложных срабатываний и какофонии в ближней зоне
 */

// Переменные состояния
let isAudioEnabled = true;
let currentFrequency = 200;
let startDistance = null;
let isPlaying = false;

// Константы частот
const minFreq = 200;
const maxFreq = 800;

// Настройки навигации
const NAVIGATION_SETTINGS = {
    directionSensitivity: 3,      // метров для определения направления
    historySize: 5,               // количество измерений для анализа тренда
    criticalZone: 10,             // метров для критической зоны
    precisionZone: 30,            // метров для зоны точности
    guidanceZone: 100,            // метров для зоны наведения
    minSoundInterval: 0.8,        // секунд минимум между звуками в критической зоне
    trendConfidenceThreshold: 2,  // минимальная уверенность в тренде (метры)
    // Настройки режима "с музыкой"
    musicMode: false,             // режим для бега с музыкой
    frequencyMultiplier: 1.0,     // множитель частоты (1.8 для режима с музыкой)
    volumeMultiplier: 1.0,        // множитель громкости (2.0 для режима с музыкой)
    useSharpSounds: false,        // использовать резкие звуки (square/sawtooth)
};

// История движения для умного определения направления
const movementHistory = [];

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
function playTone(frequency, duration = 0.3, type = 'sine', volume = 0.3) {
    if (!initAudioContext() || !isAudioEnabled || isPlaying) {
        return;
    }
    
    stopCurrentSound();
    
    try {
        oscillator = audioContext.createOscillator();
        const toneGain = audioContext.createGain();
        
        // Применяем настройки режима "с музыкой"
        const adjustedFrequency = frequency * NAVIGATION_SETTINGS.frequencyMultiplier;
        const adjustedVolume = volume * NAVIGATION_SETTINGS.volumeMultiplier;
        const adjustedDuration = NAVIGATION_SETTINGS.musicMode ? duration * 1.3 : duration;
        
        // Выбираем тип волны в зависимости от режима
        let waveType = type;
        if (NAVIGATION_SETTINGS.useSharpSounds && (type === 'sine' || type === 'triangle')) {
            // Для критических зон используем square, для остальных - sawtooth
            waveType = (frequency > 600) ? 'square' : 'sawtooth';
        }
        
        oscillator.type = waveType;
        oscillator.frequency.value = adjustedFrequency;
        
        // Настраиваем громкость
        toneGain.gain.value = Math.min(adjustedVolume, 0.9); // Ограничиваем максимум 0.9
        
        oscillator.connect(toneGain);
        toneGain.connect(gainNode);
        
        // Плавное нарастание и затухание (более резкое в режиме с музыкой)
        const now = audioContext.currentTime;
        const fadeTime = NAVIGATION_SETTINGS.musicMode 
            ? Math.min(adjustedDuration * 0.05, 0.03)  // Более резкая атака
            : Math.min(adjustedDuration * 0.1, 0.05);
        
        toneGain.gain.setValueAtTime(0, now);
        toneGain.gain.linearRampToValueAtTime(Math.min(adjustedVolume, 0.9), now + fadeTime);
        toneGain.gain.linearRampToValueAtTime(Math.min(adjustedVolume, 0.9), now + adjustedDuration - fadeTime);
        toneGain.gain.linearRampToValueAtTime(0, now + adjustedDuration);
        
        oscillator.start(now);
        oscillator.stop(now + adjustedDuration);
        
        isPlaying = true;
        
        // Сбрасываем флаг после завершения
        setTimeout(() => {
            isPlaying = false;
            try {
                toneGain.disconnect();
            } catch (e) {
                // Игнорируем ошибки очистки
            }
        }, adjustedDuration * 1000 + 100);
        
    } catch (error) {
        console.warn('Ошибка воспроизведения звука:', error);
        isPlaying = false;
    }
}

// Воспроизведение аккорда (два тона одновременно)
function playChord(frequency1, frequency2, duration = 0.4, type = 'sine', volume = 0.2) {
    if (!initAudioContext() || !isAudioEnabled || isPlaying) {
        return;
    }
    
    stopCurrentSound();
    
    try {
        const now = audioContext.currentTime;
        
        // Применяем настройки режима "с музыкой"
        const adjustedFreq1 = frequency1 * NAVIGATION_SETTINGS.frequencyMultiplier;
        const adjustedFreq2 = frequency2 * NAVIGATION_SETTINGS.frequencyMultiplier;
        const adjustedVolume = volume * NAVIGATION_SETTINGS.volumeMultiplier;
        const adjustedDuration = NAVIGATION_SETTINGS.musicMode ? duration * 1.3 : duration;
        const fadeTime = NAVIGATION_SETTINGS.musicMode 
            ? Math.min(adjustedDuration * 0.05, 0.03)
            : Math.min(adjustedDuration * 0.1, 0.05);
        
        // Выбираем тип волны в зависимости от режима
        let waveType = type;
        if (NAVIGATION_SETTINGS.useSharpSounds && (type === 'sine' || type === 'triangle')) {
            waveType = 'sawtooth'; // Для аккордов используем sawtooth
        }
        
        // Первый тон
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.type = waveType;
        osc1.frequency.value = adjustedFreq1;
        
        // Второй тон
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.type = waveType;
        osc2.frequency.value = adjustedFreq2;
        
        // Настройка громкости с плавными переходами
        const maxVolume = Math.min(adjustedVolume, 0.9);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(maxVolume, now + fadeTime);
        gain1.gain.linearRampToValueAtTime(maxVolume, now + adjustedDuration - fadeTime);
        gain1.gain.linearRampToValueAtTime(0, now + adjustedDuration);
        
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(maxVolume, now + fadeTime);
        gain2.gain.linearRampToValueAtTime(maxVolume, now + adjustedDuration - fadeTime);
        gain2.gain.linearRampToValueAtTime(0, now + adjustedDuration);
        
        osc1.connect(gain1);
        gain1.connect(gainNode);
        osc2.connect(gain2);
        gain2.connect(gainNode);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + adjustedDuration);
        osc2.stop(now + adjustedDuration);
        
        isPlaying = true;
        
        // Очистка после завершения
        setTimeout(() => {
            try {
                osc1.disconnect();
                osc2.disconnect();
                gain1.disconnect();
                gain2.disconnect();
            } catch (e) {
                // Игнорируем ошибки очистки
            }
            isPlaying = false;
        }, adjustedDuration * 1000 + 100);
        
    } catch (error) {
        console.warn('Ошибка воспроизведения аккорда:', error);
        isPlaying = false;
    }
}

// Пульсирующий тон для критической зоны
function playPulsingTone(frequency, pulseDuration = 0.15, pulses = 3) {
    if (!initAudioContext() || !isAudioEnabled || isPlaying) {
        return;
    }
    
    stopCurrentSound();
    isPlaying = true;
    
    let pulseCount = 0;
    
    function playNextPulse() {
        if (pulseCount >= pulses || !isPlaying) {
            isPlaying = false;
            return;
        }
        
        try {
            const osc = audioContext.createOscillator();
            const pulseGain = audioContext.createGain();
            
            // Применяем настройки режима "с музыкой"
            const adjustedFrequency = frequency * NAVIGATION_SETTINGS.frequencyMultiplier;
            const adjustedPulseDuration = NAVIGATION_SETTINGS.musicMode ? pulseDuration * 1.2 : pulseDuration;
            const adjustedVolume = 0.4 * NAVIGATION_SETTINGS.volumeMultiplier;
            
            // Выбираем тип волны
            let waveType = 'sine';
            if (NAVIGATION_SETTINGS.useSharpSounds) {
                waveType = 'square'; // Для критических зон используем square
            }
            
            osc.frequency.value = adjustedFrequency;
            osc.type = waveType;
            
            const now = audioContext.currentTime;
            const fadeTime = NAVIGATION_SETTINGS.musicMode 
                ? adjustedPulseDuration * 0.1  // Более резкая атака
                : adjustedPulseDuration * 0.2;
            
            // Пульсирующая огибающая
            const maxVolume = Math.min(adjustedVolume, 0.9);
            pulseGain.gain.setValueAtTime(0, now);
            pulseGain.gain.linearRampToValueAtTime(maxVolume, now + fadeTime);
            pulseGain.gain.linearRampToValueAtTime(maxVolume, now + adjustedPulseDuration - fadeTime);
            pulseGain.gain.linearRampToValueAtTime(0, now + adjustedPulseDuration);
            
            osc.connect(pulseGain);
            pulseGain.connect(gainNode);
            
            osc.start(now);
            osc.stop(now + adjustedPulseDuration);
            
            pulseCount++;
            
            // Планируем следующий импульс
            setTimeout(() => {
                try {
                    pulseGain.disconnect();
                } catch (e) {
                    // Игнорируем ошибки очистки
                }
                
                if (pulseCount < pulses) {
                    const pauseTime = NAVIGATION_SETTINGS.musicMode ? 30 : 50; // Более короткая пауза в режиме с музыкой
                    setTimeout(playNextPulse, pauseTime);
                } else {
                    isPlaying = false;
                }
            }, adjustedPulseDuration * 1000);
            
        } catch (error) {
            console.warn('Ошибка воспроизведения импульса:', error);
            isPlaying = false;
        }
    }
    
    playNextPulse();
}

// ===== ТЕСТОВЫЕ ВАРИАНТЫ ЗВУКОВ ДЛЯ ОТЛАДКИ =====
// Базовая частота для отладочных примеров (средний тон)
function getDebugBaseFrequency() {
    return 450; // между minFreq и maxFreq, комфортная середина
}

// Глубокий "таинственный" звук с легким ревербом для приближения
function playDeepMysteriousApproaching(frequency, duration = 0.7, volume = 0.35) {
    if (!initAudioContext() || !isAudioEnabled || isPlaying) {
        return;
    }

    stopCurrentSound();

    try {
        const now = audioContext.currentTime;

        // Основной тон и две низкие гармоники
        const oscMain = audioContext.createOscillator();
        oscMain.type = 'sine';
        oscMain.frequency.value = frequency;

        const oscLow = audioContext.createOscillator();
        oscLow.type = 'sine';
        oscLow.frequency.value = frequency * 0.5; // октава ниже

        const oscFifth = audioContext.createOscillator();
        oscFifth.type = 'sine';
        oscFifth.frequency.value = frequency * 0.75; // квинта ниже

        // Фильтр – приглушаем верха, оставляем низ
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = frequency * 1.5;
        filter.Q.value = 1.0;

        // Простая "реверберация" через задержку
        const delay = audioContext.createDelay();
        delay.delayTime.value = 0.18;

        const delayGain = audioContext.createGain();
        delayGain.gain.value = 0.28;

        const feedbackGain = audioContext.createGain();
        feedbackGain.gain.value = 0.2;

        // Огибающие для каждого осциллятора
        const mainGain = audioContext.createGain();
        const lowGain = audioContext.createGain();
        const fifthGain = audioContext.createGain();

        const fadeTime = duration * 0.2;
        const maxVolume = Math.min(volume, 0.8);

        mainGain.gain.setValueAtTime(0, now);
        mainGain.gain.linearRampToValueAtTime(maxVolume, now + fadeTime);
        mainGain.gain.linearRampToValueAtTime(maxVolume * 0.7, now + duration - fadeTime);
        mainGain.gain.linearRampToValueAtTime(0, now + duration);

        lowGain.gain.setValueAtTime(0, now);
        lowGain.gain.linearRampToValueAtTime(maxVolume * 0.45, now + fadeTime);
        lowGain.gain.linearRampToValueAtTime(maxVolume * 0.35, now + duration - fadeTime);
        lowGain.gain.linearRampToValueAtTime(0, now + duration);

        fifthGain.gain.setValueAtTime(0, now);
        fifthGain.gain.linearRampToValueAtTime(maxVolume * 0.35, now + fadeTime);
        fifthGain.gain.linearRampToValueAtTime(maxVolume * 0.25, now + duration - fadeTime);
        fifthGain.gain.linearRampToValueAtTime(0, now + duration);

        // Соединяем цепочку
        oscMain.connect(mainGain);
        oscLow.connect(lowGain);
        oscFifth.connect(fifthGain);

        mainGain.connect(filter);
        lowGain.connect(filter);
        fifthGain.connect(filter);

        // Прямой сигнал
        filter.connect(gainNode);

        // Реверб: фильтр -> delay -> delayGain -> выход + feedback
        filter.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(gainNode);
        delayGain.connect(feedbackGain);
        feedbackGain.connect(delay);

        // Запускаем
        oscMain.start(now);
        oscLow.start(now);
        oscFifth.start(now);
        oscMain.stop(now + duration);
        oscLow.stop(now + duration);
        oscFifth.stop(now + duration);

        isPlaying = true;

        setTimeout(() => {
            try {
                oscMain.disconnect();
                oscLow.disconnect();
                oscFifth.disconnect();
                mainGain.disconnect();
                lowGain.disconnect();
                fifthGain.disconnect();
                filter.disconnect();
                delay.disconnect();
                delayGain.disconnect();
                feedbackGain.disconnect();
            } catch (e) {
                // ignore
            }
            isPlaying = false;
        }, duration * 1000 + 500);
    } catch (error) {
        console.warn('Ошибка воспроизведения глубокого звука:', error);
        isPlaying = false;
    }
}

// Приближение – глубокий, таинственный вариант
export function playDebugApproachingDeep() {
    const baseFreq = getDebugBaseFrequency() * 0.8; // немного ниже для глубины
    playDeepMysteriousApproaching(baseFreq, 0.8, 0.35);
}

// Нейтральный – мягкий средний тон
export function playDebugNeutral() {
    const baseFreq = getDebugBaseFrequency();
    playTone(baseFreq, 0.25, 'triangle', 0.25);
}

// Удаление – мягкий низкий тон
export function playDebugMovingAway() {
    const baseFreq = getDebugBaseFrequency() * 0.7;
    playTone(baseFreq, 0.3, 'sine', 0.25);
}

// Критическая близость – пульсирующий сигнал, но чуть мягче по частоте
export function playDebugCritical() {
    playPulsingTone(650, 0.12, 3);
}

// Умное определение направления с анализом тренда
function getStabilizedDirection(distance) {
    // Добавляем текущее измерение в историю
    const now = Date.now();
    movementHistory.push({ distance, timestamp: now });
    
    // Удаляем старые измерения (старше 10 секунд)
    const cutoffTime = now - 10000;
    while (movementHistory.length > 0 && movementHistory[0].timestamp < cutoffTime) {
        movementHistory.shift();
    }
    
    // Ограничиваем размер истории
    if (movementHistory.length > NAVIGATION_SETTINGS.historySize) {
        movementHistory.shift();
    }
    
    // Нужно минимум 3 измерения для анализа тренда
    if (movementHistory.length < 3) {
        return 'neutral';
    }
    
    // Анализируем тренд методом линейной регрессии (упрощенно)
    const recentHistory = movementHistory.slice(-NAVIGATION_SETTINGS.historySize);
    const firstDistance = recentHistory[0].distance;
    const lastDistance = recentHistory[recentHistory.length - 1].distance;
    const trend = firstDistance - lastDistance; // Положительный = приближение
    
    // Вычисляем уверенность в тренде
    const confidence = Math.abs(trend);
    
    // Если тренд неясен - играем нейтральный звук
    if (confidence < NAVIGATION_SETTINGS.trendConfidenceThreshold) {
        return 'neutral';
    }
    
    // Дополнительная проверка: анализируем последние 3 измерения
    if (recentHistory.length >= 3) {
        const last3 = recentHistory.slice(-3);
        const shortTrend = last3[0].distance - last3[2].distance;
        
        // Если краткосрочный и долгосрочный тренды противоречат друг другу
        if (Math.sign(trend) !== Math.sign(shortTrend) && Math.abs(shortTrend) > 1) {
            return 'neutral';
        }
    }
    
    return trend > 0 ? 'approaching' : 'moving_away';
}

// Определение зоны навигации
function getNavigationZone(distance) {
    if (distance <= NAVIGATION_SETTINGS.criticalZone) return 'critical';
    if (distance <= NAVIGATION_SETTINGS.precisionZone) return 'precision';
    if (distance <= NAVIGATION_SETTINGS.guidanceZone) return 'guidance';
    return 'search';
}

// Получение прогресса частоты
function getTargetFrequencyProgress(distance) {
    if (startDistance === null) {
        startDistance = distance;
        return 0;
    }
    
    if (distance <= 5) {
        return 1;
    }
    
    const progress = (startDistance - distance) / startDistance;
    return Math.max(0, Math.min(1, progress));
}

// Основная функция навигации с зонами
export function playNavigationSound(distance, speed) {
    if (!isAudioEnabled || isPlaying) {
        return;
    }
    
    const zone = getNavigationZone(distance);
    const direction = getStabilizedDirection(distance);
    
    // Вычисляем частоту
    const targetProgress = getTargetFrequencyProgress(distance);
    currentFrequency = minFreq + (maxFreq - minFreq) * targetProgress;
    
    console.log(`🎵 Навигация: ${distance.toFixed(1)}м, зона: ${zone}, направление: ${direction}`);
    
    switch (zone) {
        case 'critical':
            // Критическая зона: пульсирующий тон без учета направления
            playPulsingTone(800, 0.1, 2);
            break;
            
        case 'precision':
            // Зона точности: четкие, редкие звуки
            if (direction === 'approaching') {
                // Приятный мажорный аккорд
                const majorThird = currentFrequency * Math.pow(2, 4/12);
                playChord(currentFrequency, majorThird, 0.25, 'triangle', 0.25);
            } else if (direction === 'moving_away') {
                // Мягкий предупреждающий тон (не агрессивный)
                playTone(currentFrequency * 0.75, 0.2, 'sine', 0.2);
            } else {
                // Нейтральный тон
                playTone(currentFrequency, 0.15, 'triangle', 0.15);
            }
            break;
            
        case 'guidance':
            // Зона наведения: обычная навигация
            if (direction === 'approaching') {
                // Яркий мажорный аккорд
                const majorThird = currentFrequency * Math.pow(2, 4/12);
                playChord(currentFrequency, majorThird, 0.3, 'triangle', 0.3);
            } else if (direction === 'moving_away') {
                // Мягкий низкий тон вместо агрессивного минорного аккорда
                playTone(currentFrequency * 0.7, 0.25, 'sine', 0.25);
            } else {
                // Нейтральный тон
                playTone(currentFrequency, 0.2, 'triangle', 0.2);
            }
            break;
            
        case 'search':
            // Зона поиска: базовая навигация с большими интервалами
            if (direction === 'approaching') {
                const majorThird = currentFrequency * Math.pow(2, 4/12);
                playChord(currentFrequency, majorThird, 0.4, 'triangle', 0.35);
            } else if (direction === 'moving_away') {
                playTone(currentFrequency * 0.6, 0.3, 'sine', 0.3);
            } else {
                playTone(currentFrequency, 0.25, 'triangle', 0.25);
            }
            break;
    }
}


// Получение адаптивного интервала между звуками
export function getSoundInterval(distance) {
    const zone = getNavigationZone(distance);
    
    switch (zone) {
        case 'critical':
            return NAVIGATION_SETTINGS.minSoundInterval; // 0.8 сек - нет какофонии!
            
        case 'precision':
            return 1.2; // Умеренная частота
            
        case 'guidance':
            return 2.0; // Обычная частота
            
        case 'search':
            // Адаптивный интервал для дальних расстояний
            if (startDistance === null) return 3.0;
            const progress = Math.max(0, (startDistance - distance) / startDistance);
            return 3.5 - 1.5 * progress; // 3.5 → 2.0 сек
            
        default:
            return 3.0;
    }
}

// Включение/отключение звука
export function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    
    if (!isAudioEnabled) {
        stopCurrentSound();
    }
    
    console.log(`🔊 Звук ${isAudioEnabled ? 'включен' : 'отключен'}`);
    return isAudioEnabled;
}

// Получение статуса звука
export function isAudioOn() {
    return isAudioEnabled;
}

// Сброс состояния навигации
export function resetNavigation() {
    startDistance = null;
    movementHistory.length = 0; // Очищаем историю движения
    stopCurrentSound();
    console.log('🔄 Навигация сброшена');
}

// Получение статистики навигации для отладки
export function getNavigationStats() {
    return {
        isAudioEnabled,
        currentFrequency: currentFrequency.toFixed(1),
        startDistance,
        historySize: movementHistory.length,
        zone: startDistance ? getNavigationZone(movementHistory[movementHistory.length - 1]?.distance || 0) : 'unknown',
        settings: NAVIGATION_SETTINGS
    };
}

// Настройка параметров навигации
export function updateNavigationSettings(newSettings) {
    Object.assign(NAVIGATION_SETTINGS, newSettings);
    console.log('⚙️ Настройки навигации обновлены:', NAVIGATION_SETTINGS);
}

// Воспроизведение победного звука
let victoryCallback = null;

export function playVictorySound(onComplete = null) {
    if (!initAudioContext() || !isAudioEnabled) {
        if (onComplete) onComplete();
        return;
    }
    
    victoryCallback = onComplete;
    
    console.log('🎉 Воспроизведение победного звука');
    
    // Последовательность тонов для победной мелодии (восходящая гамма)
    const victoryMelody = [
        { freq: 523, duration: 0.15 }, // C
        { freq: 659, duration: 0.15 }, // E
        { freq: 784, duration: 0.15 }, // G
        { freq: 1047, duration: 0.4 }  // C высокая
    ];
    
    let currentNoteIndex = 0;
    
    function playNextNote() {
        if (currentNoteIndex >= victoryMelody.length) {
            // Мелодия завершена
            console.log('✅ Победный звук завершен');
            if (victoryCallback) {
                victoryCallback();
                victoryCallback = null;
            }
            return;
        }
        
        const note = victoryMelody[currentNoteIndex];
        playTone(note.freq, note.duration, 'sine', 0.4);
        
        currentNoteIndex++;
        setTimeout(playNextNote, note.duration * 1000 + 50);
    }
    
    playNextNote();
}

// Получение длительности победного звука (для расчетов)
export function getVictorySoundDuration() {
    return 0.15 + 0.15 + 0.15 + 0.4 + 0.15; // Общая длительность мелодии + паузы
}

// Функции для отладочной страницы (заглушки)
export function startMovementSimulation(initialDistance, speed, callback) {
    console.log('Симуляция движения не реализована в продвинутом модуле');
}

export function stopMovementSimulation() {
    console.log('Остановка симуляции не реализована в продвинутом модуле');
}

export function getSimulationStatus() {
    return { isRunning: false, distance: 0, speed: 0 };
}

// ===== КЭШИРОВАНИЕ ИНСТРУМЕНТОВ TONE.JS =====
// Кэш для загруженных инструментов
const instrumentCache = new Map();
const loadingPromises = new Map();

// ===== TONE.JS ВАРИАНТЫ ЗВУКОВ =====
// Проверка доступности Tone.js
function isToneJSAvailable() {
    return typeof Tone !== 'undefined';
}

// Инициализация Tone.js контекста
async function initToneJS() {
    if (!isToneJSAvailable()) {
        console.warn('Tone.js не загружен');
        return false;
    }
    
    if (Tone.context.state !== 'running') {
        await Tone.start();
    }
    return true;
}

// Вариант 1: Чистый Synth без модуляции (без глухого звука)
export async function playToneJS_AMSynth(frequency = 450, duration = 0.3) {
    if (!isAudioEnabled || !await initToneJS()) return;
    
    try {
        const synth = new Tone.Synth({
            oscillator: {
                type: 'sine' // Чистый синус, без гармоник
            },
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.5,
                release: 0.2 // Короткий release, чтобы не было гула
            },
            volume: -10
        }).toDestination();
        
        synth.triggerAttackRelease(frequency, duration);
        
        setTimeout(() => {
            synth.dispose();
        }, duration * 1000 + 100);
    } catch (error) {
        console.warn('Ошибка Tone.js CleanSynth:', error);
    }
}

// Вариант 2: Synth с highpass фильтром (убирает низкие частоты)
export async function playToneJS_FMSynth(frequency = 450, duration = 0.3) {
    if (!isAudioEnabled || !await initToneJS()) return;
    
    try {
        const synth = new Tone.Synth({
            oscillator: {
                type: 'triangle' // Мягче чем square
            },
            envelope: {
                attack: 0.01,
                decay: 0.12,
                sustain: 0.4,
                release: 0.2
            },
            volume: -8
        });
        
        // Highpass фильтр - убирает низкие частоты (глухой гул)
        const filter = new Tone.Filter({
            type: 'highpass',
            frequency: frequency * 0.8, // Отсекаем все ниже основной частоты
            Q: 1
        }).toDestination();
        
        synth.connect(filter);
        synth.triggerAttackRelease(frequency, duration);
        
        setTimeout(() => {
            synth.dispose();
            filter.dispose();
        }, duration * 1000 + 100);
    } catch (error) {
        console.warn('Ошибка Tone.js SynthHighPass:', error);
    }
}

// Вариант 3: Упрощенный AMSynth (минимальная модуляция)
export async function playToneJS_SynthWithFilter(frequency = 450, duration = 0.3) {
    if (!isAudioEnabled || !await initToneJS()) return;
    
    try {
        const synth = new Tone.AMSynth({
            oscillator: {
                type: 'sine'
            },
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.4,
                release: 0.2
            },
            harmonicity: 1.0, // Без дополнительных частот
            modulation: {
                type: 'sine'
            },
            modulationEnvelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.1, // Минимальная модуляция
                release: 0.1
            },
            volume: -10
        }).toDestination();
        
        synth.triggerAttackRelease(frequency, duration);
        
        setTimeout(() => {
            synth.dispose();
        }, duration * 1000 + 100);
    } catch (error) {
        console.warn('Ошибка Tone.js AMSynthLight:', error);
    }
}

// Вариант 4: Простой MonoSynth с highpass (без низких частот)
export async function playToneJS_DuoSynth(frequency = 450, duration = 0.3) {
    if (!isAudioEnabled || !await initToneJS()) return;
    
    try {
        const synth = new Tone.MonoSynth({
            oscillator: {
                type: 'sine'
            },
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.5,
                release: 0.2
            },
            filter: {
                type: 'highpass', // Убираем низкие частоты
                frequency: frequency * 0.9,
                Q: 0.5
            },
            filterEnvelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.5,
                release: 0.2,
                baseFrequency: frequency,
                octaves: 0 // Без октав ниже!
            },
            volume: -10
        }).toDestination();
        
        synth.triggerAttackRelease(frequency, duration);
        
        setTimeout(() => {
            synth.dispose();
        }, duration * 1000 + 100);
    } catch (error) {
        console.warn('Ошибка Tone.js MonoSynthClean:', error);
    }
}

// Вариант 5: Synth с легким ревербом, но без низких частот
export async function playToneJS_MonoSynthWithReverb(frequency = 450, duration = 0.3) {
    if (!isAudioEnabled || !await initToneJS()) return;
    
    try {
        const synth = new Tone.Synth({
            oscillator: {
                type: 'sine'
            },
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.5,
                release: 0.2
            },
            volume: -5 // Громче
        });
        
        // Highpass фильтр перед ревербом - убирает низкие частоты
        const filter = new Tone.Filter({
            type: 'highpass',
            frequency: frequency * 0.85,
            Q: 1
        });
        
        // Больше реверба для пространства
        const reverb = new Tone.Reverb({
            roomSize: 0.6, // Больше помещение
            dampening: 2000,
            wet: 0.35 // Больше реверба (35%)
        }).toDestination();
        
        synth.connect(filter);
        filter.connect(reverb);
        synth.triggerAttackRelease(frequency, duration);
        
        setTimeout(() => {
            synth.dispose();
            filter.dispose();
            reverb.dispose();
        }, duration * 1000 + 300); // Больше времени для реверба
    } catch (error) {
        console.warn('Ошибка Tone.js Synth+Reverb:', error);
    }
}

// ===== ЗВУК ПРИБЛИЖЕНИЯ С СЭМПЛОМ КСИЛОФОНА =====
// Инициализация ксилофона с кэшированием
async function initXylophoneSampler() {
    const instrumentName = 'xylophone';
    
    // Если уже загружен - возвращаем сразу
    if (instrumentCache.has(instrumentName)) {
        return instrumentCache.get(instrumentName);
    }
    
    // Если уже загружается - ждем существующий промис
    if (loadingPromises.has(instrumentName)) {
        return await loadingPromises.get(instrumentName);
    }
    
    if (!isToneJSAvailable()) {
        console.warn('Tone.js не загружен');
        return null;
    }
    
    await initToneJS();
    
    // Создаем промис загрузки
    const loadPromise = (async () => {
        try {
            // Создаем Sampler с одним сэмплом C5
            // Tone.js автоматически транспонирует его для других нот
            const sampler = new Tone.Sampler({
                urls: {
                    C5: "C5.mp3"
                },
                release: 1,
                baseUrl: "./assets/samples/xylophone/"
            }).toDestination();
            
            // Ждем загрузки сэмпла
            await Tone.loaded();
            
            // Сохраняем в кэш
            instrumentCache.set(instrumentName, sampler);
            console.log(`✅ Ксилофон загружен и закэширован`);
            
            return sampler;
        } catch (error) {
            console.error(`Ошибка загрузки ксилофона:`, error);
            loadingPromises.delete(instrumentName);
            return null;
        } finally {
            loadingPromises.delete(instrumentName);
        }
    })();
    
    loadingPromises.set(instrumentName, loadPromise);
    return await loadPromise;
}

// Воспроизведение звука приближения с динамическим изменением высоты
export async function playApproachingSound(distance) {
    if (!isAudioEnabled) return;
    
    // Получаем ксилофон из кэша (или загружаем если нет)
    const xylophone = await initXylophoneSampler();
    
    if (!xylophone) {
        console.warn('Ксилофон не загружен');
        return;
    }
    
    // Логика изменения высоты:
    // До 100м - монотонный звук (C5)
    // От 100 до 0м - звук плавно повышается от C5 до C8
    
    let note = "C5"; // Базовая нота (монотонная до 100м)
    
    if (distance >= 100) {
        // От 100м и дальше - монотонный звук C5
        note = "C5";
    } else {
        // От 100 до 0м: вычисляем высоту с плавным изменением
        // 100м = C5, 0м = C6 (1 октава = 12 полутонов выше) - медленнее рост
        const progress = 1 - (distance / 100); // 0 при 100м, 1 при 0м
        const semitones = Math.floor(progress * 12); // От 0 до 12 полутонов (вместо 36)
        
        // Преобразуем полутоны в ноту
        const baseOctave = 5;
        const octave = baseOctave + Math.floor(semitones / 12);
        const noteIndex = semitones % 12;
        
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteName = notes[noteIndex];
        
        note = `${noteName}${octave}`;
    }
    
    // Играем ноту
    xylophone.triggerAttackRelease(note, "8n");
    
    console.log(`🎵 Звук приближения: ${distance.toFixed(1)}м, нота: ${note}`);
}
