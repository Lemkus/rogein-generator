/**
 * Модуль звуковой навигации с Tone.js
 * Использует качественные синтезаторы и плавное изменение тона
 */

// Переменные состояния
let isAudioEnabled = true;
let currentSynth = null;
let currentFrequency = 200; // Начальная частота (всегда низкая)
let isPlaying = false;
let lastDistance = null;
let lastSpeed = 0;
let frequencyProgress = 0; // Прогресс от низкой к высокой частоте (0-1)
let startDistance = null; // Начальное расстояние для расчета прогресса

// Константы частот
const minFreq = 200; // Всегда начинаем с низкой частоты
const maxFreq = 800; // Всегда заканчиваем высокой частотой

// Инициализация Tone.js
function initTone() {
    // Проверяем, что Tone.js загружен
    if (typeof Tone === 'undefined') {
        console.error('❌ Tone.js не загружен!');
        const statusEl5 = document.getElementById('navStatus');
        if (statusEl5) {
            statusEl5.textContent = '❌ Tone.js не загружен!';
        }
        return false;
    }
    
    // Запускаем аудио контекст
    if (Tone.context.state !== 'running') {
        Tone.start().then(() => {
            console.log('🎵 Tone.js аудио контекст запущен');
            const statusEl6 = document.getElementById('navStatus');
            if (statusEl6) {
                statusEl6.textContent = '🎵 Tone.js запущен';
            }
        }).catch(err => {
            console.error('❌ Ошибка запуска Tone.js:', err);
            const statusEl7 = document.getElementById('navStatus');
            if (statusEl7) {
                statusEl7.textContent = '❌ Ошибка Tone.js';
            }
        });
    } else {
        // Аудио контекст уже запущен
        const statusEl8 = document.getElementById('navStatus');
        if (statusEl8) {
            statusEl8.textContent = '🎵 Tone.js уже запущен :(';
        }
    }
    
    return true;
}

// Получение целевого прогресса частоты в зависимости от расстояния
function getTargetFrequencyProgress(distance) {
    // ПРОСТАЯ ЛОГИКА: прогресс = процент пройденного пути
    // Если начали с 2000м и сейчас 1500м, то прошли 25% пути
    
    // Если мы на старте (startDistance не установлен) - сохраняем начальное расстояние
    if (startDistance === null) {
        startDistance = distance;
        console.log(`🎯 Установлено начальное расстояние: ${startDistance}м`);
        
        // Обновляем статус навигации
        const statusEl9 = document.getElementById('navStatus');
        if (statusEl9) {
            const currentText = statusEl9.textContent;
            statusEl9.textContent = `${currentText} | 🎯${startDistance}м`;
        }
        
        return 0;
    }
    
    // Если мы достигли цели - возвращаем 100%
    if (distance <= 10) {
        return 1;
    }
    
    // Прогресс = сколько процентов пути мы прошли
    const progress = (startDistance - distance) / startDistance;
    console.log(`📊 Прогресс: ${(progress*100).toFixed(1)}% (${startDistance}м → ${distance}м)`);
    
    // Ограничиваем прогресс от 0 до 1, чтобы избежать отрицательных частот
    const clampedProgress = Math.max(0, Math.min(1, progress));
    console.log(`📊 Ограниченный прогресс: ${(clampedProgress*100).toFixed(1)}%`);
    
    return clampedProgress;
}

// Создание звука приближения (мажорный, яркий)
function createApproachingSound(frequency) {
    if (!initTone()) {
        const statusEl10 = document.getElementById('navStatus');
        if (statusEl10) {
            statusEl10.textContent = '❌ Tone.js не инициализирован';
        }
        return;
    }
    
    // Обновляем статус
    const statusEl11 = document.getElementById('navStatus');
    if (statusEl11) {
        statusEl11.textContent = `🎵 Создаем звук приближения: ${Math.round(frequency)}Hz`;
    }
    
    // Создаем более приятный синтезатор для приближения
    const synth = new Tone.Synth({
        oscillator: {
            type: 'triangle' // Более мягкий звук
        },
        envelope: {
            attack: 0.05,
            decay: 0.1,
            sustain: 0.3,
            release: 0.4
        }
    }).toDestination();
    
    // Добавляем легкий реверб для приятности
    const reverb = new Tone.Reverb({
        decay: 0.5,
        wet: 0.1
    });
    
    synth.connect(reverb);
    reverb.toDestination();
    
    // Проигрываем мажорную терцию (более яркий звук)
    const majorThird = frequency * Math.pow(2, 4/12); // Большая терция
    
    // Обновляем статус перед проигрыванием
    const statusEl12 = document.getElementById('navStatus');
    if (statusEl12) {
        statusEl12.textContent = `🎵 Играем приближение: ${Math.round(frequency)}Hz`;
    }
    
    synth.triggerAttackRelease(frequency, "8n");
    setTimeout(() => {
        synth.triggerAttackRelease(majorThird, "8n");
    }, 80);
    
    // Очищаем синтезатор
    setTimeout(() => {
        synth.dispose();
        reverb.dispose();
    }, 800);
}

// Создание звука удаления (минорный, глухой)
function createMovingAwaySound(frequency) {
    if (!initTone()) return;
    
    // Создаем более приятный синтезатор для удаления
    const synth = new Tone.Synth({
        oscillator: {
            type: 'sawtooth' // Более мягкий чем треугольник
        },
        envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.25,
            release: 0.8
        }
    }).toDestination();
    
    // Добавляем фильтр для более глухого звука
    const filter = new Tone.Filter({
        type: 'lowpass',
        frequency: frequency * 1.5,
        rolloff: -12
    });
    
    // Добавляем легкий дисторшн для характерности
    const distortion = new Tone.Distortion(0.1);
    
    synth.connect(filter);
    filter.connect(distortion);
    distortion.toDestination();
    
    // Проигрываем минорную терцию (более грустный звук)
    const minorThird = frequency * Math.pow(2, 3/12); // Малая терция
    
    // Обновляем статус перед проигрыванием
    const statusEl13 = document.getElementById('navStatus');
    if (statusEl13) {
        statusEl13.textContent = `🎵 Играем удаление: ${Math.round(frequency)}Hz`;
    }
    
    synth.triggerAttackRelease(frequency, "4n");
    setTimeout(() => {
        synth.triggerAttackRelease(minorThird, "4n");
    }, 120);
    
    // Очищаем синтезатор
    setTimeout(() => {
        synth.dispose();
        filter.dispose();
        distortion.dispose();
    }, 1200);
}

// Основная функция навигации с плавным изменением тона
export function playNavigationSound(distance, speed) {
    if (!isAudioEnabled) {
        console.log('🔇 Звук отключен');
        const navStatus = document.getElementById('navStatus');
        if (navStatus) {
            navStatus.textContent = '🔇 Звук отключен';
        }
        return;
    }
    
    let isApproaching = false;
    
    // Определяем направление по скорости
    if (speed > 0.1) {
        isApproaching = true;
    } else if (speed < -0.1) {
        isApproaching = false;
    } else {
        // Если скорость нейтральная, определяем по изменению расстояния
        if (lastDistance !== null) {
            isApproaching = distance < lastDistance;
        } else {
            isApproaching = distance < 100; // По умолчанию считаем приближением
        }
    }
    
    
    // Получаем целевой прогресс частоты в зависимости от расстояния
    const targetProgress = getTargetFrequencyProgress(distance);
    
    // Простое решение: прогресс = целевой прогресс
    // Тон меняется сразу в зависимости от расстояния
    frequencyProgress = targetProgress;
    
    // Вычисляем текущую частоту на основе прогресса
    // Ограничиваем прогресс от 0 до 1, чтобы частота была в допустимом диапазоне
    const clampedProgress = Math.max(0, Math.min(1, frequencyProgress));
    currentFrequency = minFreq + (maxFreq - minFreq) * clampedProgress;
    
    console.log(`🎵 Частота: ${Math.round(currentFrequency)}Hz (прогресс: ${(frequencyProgress*100).toFixed(1)}%, ограниченный: ${(clampedProgress*100).toFixed(1)}%)`);
    
    // Дополнительный буст не нужен - максимальный тон уже достигается при близком расстоянии
    
    // Проигрываем звук в зависимости от направления
    if (isApproaching) {
        createApproachingSound(currentFrequency);
        console.log(`🎵 Приближение: ${Math.round(currentFrequency)}Hz (прогресс: ${(frequencyProgress*100).toFixed(1)}%, целевой: ${(targetProgress*100).toFixed(1)}%), расстояние: ${Math.round(distance)}м, скорость: ${speed}`);
        
        // Обновляем статус навигации с информацией о звуке
        const statusEl3 = document.getElementById('navStatus');
        if (statusEl3) {
            const currentText = statusEl3.textContent;
            statusEl3.textContent = `${currentText} | 🎵${Math.round(currentFrequency)}Hz ↗️`;
        }
    } else {
        createMovingAwaySound(currentFrequency);
        console.log(`🎵 Удаление: ${Math.round(currentFrequency)}Hz (прогресс: ${(frequencyProgress*100).toFixed(1)}%, целевой: ${(targetProgress*100).toFixed(1)}%), расстояние: ${Math.round(distance)}м, скорость: ${speed}`);
        
        // Обновляем статус навигации с информацией о звуке
        const statusEl4 = document.getElementById('navStatus');
        if (statusEl4) {
            const currentText = statusEl4.textContent;
            statusEl4.textContent = `${currentText} | 🎵${Math.round(currentFrequency)}Hz ↘️`;
        }
    }
    
    lastDistance = distance;
    lastSpeed = speed;
}

// Создание звука победы с Tone.js
export function playVictorySound() {
    if (!isAudioEnabled) return;
    
    if (!initTone()) return;
    
    // Создаем основной синтезатор для мелодии
    const melodySynth = new Tone.Synth({
        oscillator: {
            type: "triangle"
        },
        envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.8,
            release: 0.8
        }
    });
    
    // Создаем синтезатор для аккордов
    const chordSynth = new Tone.Synth({
        oscillator: {
            type: "sine"
        },
        envelope: {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.7,
            release: 1.5
        }
    });
    
    // Добавляем реверб для торжественности
    const reverb = new Tone.Reverb({
        decay: 2,
        wet: 0.3
    }).toDestination();
    
    melodySynth.connect(reverb);
    chordSynth.connect(reverb);
    
    // Торжественная восходящая мелодия
    const melody = ["C4", "E4", "G4", "C5", "E5", "G5", "C6"];
    
    melody.forEach((note, index) => {
        melodySynth.triggerAttackRelease(note, "8n", `+${index * 0.2}`);
    });
    
    // Финальный торжественный аккорд
    setTimeout(() => {
        chordSynth.triggerAttackRelease("C5", "1n");
        chordSynth.triggerAttackRelease("E5", "1n", "+0.1");
        chordSynth.triggerAttackRelease("G5", "1n", "+0.2");
        chordSynth.triggerAttackRelease("C6", "1n", "+0.3");
    }, 1500);
    
    // Очищаем ресурсы
    setTimeout(() => {
        melodySynth.dispose();
        chordSynth.dispose();
        reverb.dispose();
    }, 4000);
    
    console.log('🏆🎺🎉 ТРИУМФАЛЬНЫЕ ФАНФАРЫ! ПОБЕДА! 🎉🎺🏆');
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
    // Ритм зависит от прогресса навигации
    // Медленный ритм на больших расстояниях, быстрый при приближении
    
    // Если мы на старте - медленный ритм
    if (startDistance === null) {
        console.log('⏱️ getSoundInterval: старт, возвращаем 3.0с');
        return 3.0; // 3 секунды
    }
    
    // Если мы достигли цели - очень быстрый ритм
    if (distance <= 10) {
        console.log('⏱️ getSoundInterval: цель близко, возвращаем 0.2с');
        return 0.2; // 0.2 секунды
    }
    
    // Ритм зависит от прогресса (как и тон)
    const progress = (startDistance - distance) / startDistance;
    
    // Интервал от 3 сек (медленно) до 0.2 сек (быстро)
    const minInterval = 0.2; // Быстрый ритм при приближении
    const maxInterval = 3.0; // Медленный ритм на старте
    
    // Ритм ускоряется по мере приближения
    // Ограничиваем прогресс от 0 до 1, чтобы избежать отрицательных интервалов
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const interval = maxInterval - (maxInterval - minInterval) * clampedProgress;
    
    console.log(`⏱️ getSoundInterval: возвращаем ${interval.toFixed(1)}с (прогресс: ${(progress*100).toFixed(1)}%)`);
    
    // Обновляем статус навигации с информацией о ритме
    const statusEl14 = document.getElementById('navStatus');
    if (statusEl14) {
        const currentText = statusEl14.textContent;
        statusEl14.textContent = `${currentText} | ⏱️${interval.toFixed(1)}с`;
    }
    
    return interval;
}

// Функция для тестирования (для отладочной страницы)
export function playTestSound(distance, speed) {
    playNavigationSound(distance, speed);
}

// Создание звука победы (для отладочной страницы)
export function createVictorySound() {
    playVictorySound();
}

// Симулятор движения к цели
let simulationInterval = null;
let currentSimulationDistance = 0;
let simulationSpeed = 0;
let simulationTarget = 0;
let simulationCallback = null;

export function startMovementSimulation(initialDistance, speed, callback) {
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
        
        if (simulationSpeed > 0 && currentSimulationDistance <= 10) {
            // Достигли цели при приближении!
            currentSimulationDistance = 0;
            stopMovementSimulation();
            
            if (isAudioEnabled) {
                playVictorySound();
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

export function stopMovementSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
}

export function getSimulationStatus() {
    return {
        isRunning: simulationInterval !== null,
        distance: currentSimulationDistance,
        speed: simulationSpeed,
        target: simulationTarget
    };
}

// Функция для получения базовой частоты (для отладочной страницы)
export function getBaseFrequency(distance) {
    const targetProgress = getTargetFrequencyProgress(distance);
    return minFreq + (maxFreq - minFreq) * targetProgress;
}

// Функция для сброса начального расстояния (для новой навигации)
export function resetNavigation() {
    startDistance = null;
    frequencyProgress = 0;
    lastDistance = null;
}
