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

// Очередь звуков, запрошенных пока контекст был suspended
let _pendingSound = null;

// Возобновляем AudioContext при возврате приложения на передний план
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && audioContext?.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
});

// На Android (Capacitor) WebView сигнализирует через этот кастомный event
window.addEventListener('capacitorResume', () => {
    if (audioContext?.state === 'suspended') {
        audioContext.resume().then(() => {
            if (_pendingSound) {
                const { frequency, duration, type, volume } = _pendingSound;
                _pendingSound = null;
                playTone(frequency, duration, type, volume);
            }
        }).catch(() => {});
    }
});

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

    if (audioContext.state === 'suspended') {
        // Пытаемся возобновить асинхронно; playTone повторит попытку после resume
        audioContext.resume().catch(() => {});
        return false;
    }

    return audioContext.state === 'running';
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
    if (!isAudioEnabled) return;

    if (!initAudioContext()) {
        // Контекст suspended — запомним звук, воспроизведём после resume
        _pendingSound = { frequency, duration, type, volume };
        return;
    }

    if (isPlaying) return;
    
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
