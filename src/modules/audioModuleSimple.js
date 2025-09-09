// Простой аудио модуль для навигации
// Мажорный аккорд - приближение, минорный - удаление
// Тон и частота зависят от расстояния

let audioContext = null;
let isAudioEnabled = true;

// Инициализация аудио контекста
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Создание мажорного аккорда (приближение)
function createMajorChord(baseFreq, duration = 0.5) {
    const ctx = initAudioContext();
    
    // Мажорный аккорд: основной тон, большая терция, чистая квинта
    const frequencies = [
        baseFreq,           // Основной тон (до)
        baseFreq * 1.25,    // Большая терция (ми) - 5/4
        baseFreq * 1.5      // Чистая квинта (соль) - 3/2
    ];
    
    frequencies.forEach((freq, index) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
        oscillator.type = 'sine';
        
        // Плавное нарастание и затухание
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    });
}

// Создание минорного аккорда (удаление)
function createMinorChord(baseFreq, duration = 0.5) {
    const ctx = initAudioContext();
    
    // Минорный аккорд: основной тон, малая терция, чистая квинта
    const frequencies = [
        baseFreq,           // Основной тон (до)
        baseFreq * 1.2,     // Малая терция (ми-бемоль) - 6/5
        baseFreq * 1.5      // Чистая квинта (соль) - 3/2
    ];
    
    frequencies.forEach((freq, index) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
        oscillator.type = 'sine';
        
        // Плавное нарастание и затухание
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    });
}

// Вычисление базовой частоты на основе расстояния
function getBaseFrequency(distance) {
    // Чем ближе, тем выше тон
    // Диапазон: от 200Hz (далеко) до 800Hz (близко)
    const minFreq = 200;
    const maxFreq = 800;
    const maxDistance = 200; // Максимальное расстояние для расчета
    
    // Ограничиваем расстояние
    const clampedDistance = Math.min(distance, maxDistance);
    
    // Инвертируем: чем меньше расстояние, тем выше частота
    const frequency = maxFreq - (clampedDistance / maxDistance) * (maxFreq - minFreq);
    
    return Math.max(frequency, minFreq);
}

// Вычисление интервала между звуками на основе расстояния
function getSoundInterval(distance) {
    // Чем ближе, тем чаще звуки
    // Диапазон: от 2 секунд (далеко) до 0.5 секунд (близко)
    const minInterval = 0.5;
    const maxInterval = 2.0;
    const maxDistance = 200;
    
    const clampedDistance = Math.min(distance, maxDistance);
    const interval = minInterval + (clampedDistance / maxDistance) * (maxInterval - minInterval);
    
    return interval;
}

// Основная функция навигации
let lastSoundTime = 0;
let lastDistance = null;

function playNavigationSound(distance, speed) {
    if (!isAudioEnabled) return;
    
    const ctx = initAudioContext();
    const currentTime = ctx.currentTime;
    
    // Определяем направление движения
    let isApproaching = false;
    if (lastDistance !== null) {
        if (speed > 0) {
            isApproaching = true;  // Положительная скорость = приближение
        } else if (speed < 0) {
            isApproaching = false; // Отрицательная скорость = удаление
        } else {
            isApproaching = (distance < lastDistance); // Если скорость 0, смотрим изменение расстояния
        }
    }
    
    // Вычисляем параметры звука
    const baseFreq = getBaseFrequency(distance);
    const interval = getSoundInterval(distance);
    
    // Проверяем, пора ли играть звук
    if (currentTime - lastSoundTime >= interval) {
        if (isApproaching) {
            // Приближаемся - мажорный аккорд
            createMajorChord(baseFreq, 0.6);
            console.log(`🎵 Мажорный аккорд: ${Math.round(baseFreq)}Hz, расстояние: ${Math.round(distance)}м`);
        } else {
            // Удаляемся - минорный аккорд
            createMinorChord(baseFreq, 0.6);
            console.log(`🎵 Минорный аккорд: ${Math.round(baseFreq)}Hz, расстояние: ${Math.round(distance)}м`);
        }
        
        lastSoundTime = currentTime;
    }
    
    lastDistance = distance;
}

// Функция для тестирования (без ограничений по времени)
function playTestSound(distance, speed) {
    if (!isAudioEnabled) return;
    
    const baseFreq = getBaseFrequency(distance);
    let isApproaching = false;
    
    if (speed > 0) {
        isApproaching = true;
    } else if (speed < 0) {
        isApproaching = false;
    } else {
        isApproaching = (distance < 100); // Для теста считаем приближением если расстояние < 100
    }
    
    if (isApproaching) {
        createMajorChord(baseFreq, 1.0);
        console.log(`🎵 ТЕСТ - Мажорный аккорд: ${Math.round(baseFreq)}Hz, расстояние: ${Math.round(distance)}м, скорость: ${speed}`);
    } else {
        createMinorChord(baseFreq, 1.0);
        console.log(`🎵 ТЕСТ - Минорный аккорд: ${Math.round(baseFreq)}Hz, расстояние: ${Math.round(distance)}м, скорость: ${speed}`);
    }
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
        const volume = 0.4 + (repeat * 0.1); // 0.4, 0.5, 0.6
        
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
            gainNode.gain.linearRampToValueAtTime(0.5, finalTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0.5, finalTime + 1.5);
            gainNode.gain.linearRampToValueAtTime(0, finalTime + 2.0);
            
            oscillator.start(finalTime);
            oscillator.stop(finalTime + 2.0);
        });
    }, 6000); // После всех трех мелодий
    
    console.log('🏆🎺🎉 ТРИУМФАЛЬНЫЕ ФАНФАРЫ! ПОБЕДА! 🎉🎺🏆');
}

// Симулятор движения к цели
let simulationInterval = null;
let currentSimulationDistance = 0;
let simulationSpeed = 0;
let simulationTarget = 0;
let simulationCallback = null;

function startMovementSimulation(initialDistance, speed, callback) {
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }
    
    currentSimulationDistance = initialDistance;
    simulationSpeed = speed;
    simulationTarget = 0; // Цель - достичь 0 метров
    simulationCallback = callback;
    
    console.log(`🏃‍♂️ Начинаем симуляцию: ${initialDistance}м, скорость ${speed}м/с`);
    
    // Проигрываем первый звук
    if (isAudioEnabled) {
        playTestSound(currentSimulationDistance, simulationSpeed);
    }
    
    // Запускаем симуляцию
    simulationInterval = setInterval(() => {
        // Обновляем расстояние в зависимости от направления
        if (simulationSpeed > 0) {
            // Приближаемся - уменьшаем расстояние
            currentSimulationDistance -= simulationSpeed;
        } else if (simulationSpeed < 0) {
            // Удаляемся - увеличиваем расстояние
            currentSimulationDistance += Math.abs(simulationSpeed);
        }
        
        if (simulationSpeed > 0 && currentSimulationDistance <= 0) {
            // Достигли цели при приближении!
            currentSimulationDistance = 0;
            stopMovementSimulation();
            
            if (isAudioEnabled) {
                createVictorySound();
            }
            
            if (simulationCallback) {
                simulationCallback(true, 0); // true = достигли цели
            }
        } else {
            // Продолжаем движение
            if (isAudioEnabled) {
                playTestSound(currentSimulationDistance, simulationSpeed);
            }
            
            if (simulationCallback) {
                simulationCallback(false, currentSimulationDistance);
            }
        }
    }, 1000); // Обновляем каждую секунду
}

function stopMovementSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
}

function getSimulationStatus() {
    return {
        isRunning: simulationInterval !== null,
        distance: currentSimulationDistance,
        speed: simulationSpeed,
        target: simulationTarget
    };
}

// Управление звуком
function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    console.log(`🔊 Звук ${isAudioEnabled ? 'включен' : 'отключен'}`);
    return isAudioEnabled;
}

function isAudioOn() {
    return isAudioEnabled;
}

// Экспорт функций
export {
    playNavigationSound,
    playTestSound,
    toggleAudio,
    isAudioOn,
    getBaseFrequency,
    getSoundInterval,
    startMovementSimulation,
    stopMovementSimulation,
    getSimulationStatus,
    createVictorySound
};
