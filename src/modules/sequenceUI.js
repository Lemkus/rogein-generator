/**
 * UI модуль для отображения и редактирования последовательности точек
 */

import { 
  generateOptimalSequence, 
  getCurrentSequence, 
  toggleDirection, 
  updateSequence,
  getRouteStats,
  getDirection 
} from './routeSequence.js';
import { pointMarkers } from './mapModule.js';

// DOM элементы
let sequenceSection;
let sequenceLink;
let routeStatsSpan;
let toggleDirectionBtn;
let sequenceModal;
let sequenceModalClose;
let sequenceEditor;
let sequenceInput;
let applySequenceBtn;

// Инициализация UI
export function initSequenceUI() {
  // Получаем DOM элементы
  sequenceSection = document.getElementById('sequenceSection');
  sequenceLink = document.getElementById('sequenceLink');
  routeStatsSpan = document.getElementById('routeStats');
  toggleDirectionBtn = document.getElementById('toggleDirectionBtn');
  sequenceModal = document.getElementById('sequenceModal');
  sequenceModalClose = document.getElementById('sequenceModalClose');
  sequenceEditor = document.getElementById('sequenceEditor');
  sequenceInput = document.getElementById('sequenceInput');
  applySequenceBtn = document.getElementById('applySequenceBtn');
  
  // Проверка наличия основных элементов
  if (!sequenceLink) {
    console.warn('Основной элемент sequenceLink не найден, последовательность будет недоступна');
    return false;
  }
  
  // Проверяем дополнительные элементы (могут отсутствовать в новом интерфейсе)
  if (!sequenceSection) {
    console.warn('sequenceSection не найден - некоторые функции последовательности недоступны');
  }
  if (!routeStatsSpan) {
    console.warn('routeStatsSpan не найден - статистика маршрута недоступна');
  }
  if (!toggleDirectionBtn) {
    console.warn('toggleDirectionBtn не найден - смена направления недоступна');
  }
  
  // Установка обработчиков
  setupEventHandlers();
  
  console.log('✅ UI последовательности инициализирован');
  return true;
}

// Настройка обработчиков событий
function setupEventHandlers() {
  // Клик по ссылке последовательности - открыть редактор
  if (sequenceLink) {
    sequenceLink.addEventListener('click', (e) => {
      e.preventDefault();
      openSequenceEditor();
    });
  }
  
  // Кнопка смены направления (если есть)
  if (toggleDirectionBtn) {
    toggleDirectionBtn.addEventListener('click', () => {
      const isClockwise = toggleDirection();
      updateSequenceDisplay();
      
      // Показываем уведомление
      const direction = isClockwise ? 'по часовой' : 'против часовой';
      showNotification(`🔄 Направление изменено: ${direction}`);
    });
  }
  
  // Закрытие модального окна (если есть)
  if (sequenceModalClose) {
    sequenceModalClose.addEventListener('click', closeSequenceEditor);
  }
  if (sequenceModal) {
    sequenceModal.addEventListener('click', (e) => {
      if (e.target === sequenceModal) closeSequenceEditor();
    });
  }
  
  // Применение новой последовательности (если есть)
  if (applySequenceBtn) {
    applySequenceBtn.addEventListener('click', applyNewSequence);
  }
  
  // Enter в поле ввода (если есть)
  if (sequenceInput) {
    sequenceInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyNewSequence();
      }
    });
  }
}

// Генерация и отображение последовательности
export async function generateAndDisplaySequence() {
  if (!pointMarkers || pointMarkers.length === 0) {
    hideSequenceSection();
    return;
  }
  
  // Показываем индикатор загрузки
  showSequenceLoading();
  
  try {
    // Генерируем оптимальную последовательность асинхронно
    const sequence = await generateOptimalSequenceAsync();
    
    if (sequence.length === 0) {
      hideSequenceSection();
      return;
    }
  
    // Скрываем индикатор загрузки
    hideSequenceLoading();
    
    // Отображаем последовательность
    updateSequenceDisplay();
    showSequenceSection();
    
  } catch (error) {
    console.error('Ошибка при генерации последовательности:', error);
    hideSequenceLoading();
    hideSequenceSection();
  }
}

// Скрыть индикатор загрузки последовательности
function hideSequenceLoading() {
  if (sequenceLink) {
    sequenceLink.style.cursor = 'pointer';
  }
  if (routeStatsSpan) {
    routeStatsSpan.style.color = '';
  }
}

// Показать индикатор загрузки последовательности
function showSequenceLoading() {
  if (sequenceLink) {
    sequenceLink.textContent = '⏳ Генерация оптимального маршрута...';
    sequenceLink.style.color = '#666';
    sequenceLink.style.cursor = 'default';
  }
  if (routeStatsSpan) {
    routeStatsSpan.textContent = 'Анализируем точки и строим маршрут...';
    routeStatsSpan.style.color = '#666';
  }
  
  // Показываем секцию последовательности
  if (sequenceSection) {
    sequenceSection.style.display = 'block';
  }
}

// Асинхронная генерация последовательности
async function generateOptimalSequenceAsync() {
  return new Promise((resolve) => {
    // Даем время для отображения индикатора загрузки
    setTimeout(() => {
      try {
        console.log('🔄 Начинаем генерацию оптимальной последовательности...');
        const sequence = generateOptimalSequence();
        console.log(`✅ Последовательность сгенерирована: ${sequence.length} точек`);
        resolve(sequence);
      } catch (error) {
        console.error('❌ Ошибка при генерации последовательности:', error);
        resolve([]);
      }
    }, 100); // Увеличиваем задержку для видимости индикатора
  });
}

// Обновление отображения последовательности
export function updateSequenceDisplay() {
  const sequence = getCurrentSequence();
  
  if (sequence.length === 0) {
    hideSequenceSection();
    return;
  }
  
  // Формируем текст последовательности (номера точек, начиная с 1)
  const sequenceText = sequence.map(idx => idx + 1).join(' → ');
  
  // Обновляем статистику маршрута
  const stats = getRouteStats();
  let distanceKm = 0;
  if (stats) {
    distanceKm = (stats.totalDistance / 1000).toFixed(2);
  }
  
  // Обновляем новый info-panel через uiController
  import('./uiController.js').then(ui => {
    ui.updateInfoPanel(
      sequence.length, 
      `СТАРТ → ${sequenceText} → СТАРТ`, 
      distanceKm
    );
  });
  
  // Обновляем старые элементы если они есть (для совместимости)
  if (sequenceLink) {
    sequenceLink.textContent = `СТАРТ → ${sequenceText} → СТАРТ`;
  }
  if (routeStatsSpan) {
    routeStatsSpan.textContent = `${distanceKm} км, ${stats ? stats.direction : ''}`;
  }
  if (toggleDirectionBtn) {
    const isClockwise = getDirection();
    toggleDirectionBtn.innerHTML = isClockwise ? '🔄 Против часовой' : '🔄 По часовой';
  }
}

// Показать секцию последовательности
function showSequenceSection() {
  // В новом интерфейсе последовательность отображается в info-panel
  // Эта функция теперь не нужна, так как info-panel управляется uiController
  console.log('✅ Последовательность готова для отображения');
}

// Скрыть секцию последовательности
function hideSequenceSection() {
  // В новом интерфейсе последовательность скрывается через uiController
  console.log('❌ Последовательность скрыта');
}

// Открыть редактор последовательности
function openSequenceEditor() {
  const sequence = getCurrentSequence();
  
  if (sequence.length === 0) {
    showNotification('❌ Нет последовательности для редактирования', 'error');
    return;
  }
  
  // Заполняем редактор
  renderSequenceEditor(sequence);
  
  // Заполняем текстовое поле
  sequenceInput.value = sequence.map(idx => idx + 1).join(', ');
  
  // Показываем модальное окно
  sequenceModal.style.display = 'flex';
}

// Закрыть редактор последовательности
function closeSequenceEditor() {
  sequenceModal.style.display = 'none';
}

// Отрисовка редактора последовательности
function renderSequenceEditor(sequence) {
  sequenceEditor.innerHTML = '';
  
  sequence.forEach((pointIdx, seqIdx) => {
    const item = document.createElement('div');
    item.draggable = true;
    item.dataset.pointIdx = pointIdx;
    item.dataset.seqIdx = seqIdx;
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: #f0f0f0;
      border-radius: 6px;
      cursor: move;
      user-select: none;
    `;
    
    item.innerHTML = `
      <span style="font-size: 20px;">☰</span>
      <span style="flex: 1; font-weight: 500;">Точка ${pointIdx + 1}</span>
      <span style="color: #777; font-size: 12px;">Позиция ${seqIdx + 1}</span>
    `;
    
    // Обработчики drag & drop
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
    
    sequenceEditor.appendChild(item);
  });
}

// Обработчики drag & drop
let draggedElement = null;

function handleDragStart(e) {
  draggedElement = e.currentTarget;
  e.currentTarget.style.opacity = '0.5';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const afterElement = getDragAfterElement(sequenceEditor, e.clientY);
  if (afterElement == null) {
    sequenceEditor.appendChild(draggedElement);
  } else {
    sequenceEditor.insertBefore(draggedElement, afterElement);
  }
}

function handleDrop(e) {
  e.preventDefault();
}

function handleDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  draggedElement = null;
  
  // Обновляем последовательность на основе нового порядка
  updateSequenceFromEditor();
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Обновление последовательности из редактора
function updateSequenceFromEditor() {
  const items = sequenceEditor.querySelectorAll('[draggable="true"]');
  const newSequence = Array.from(items).map(item => parseInt(item.dataset.pointIdx));
  
  // Обновляем текстовое поле
  sequenceInput.value = newSequence.map(idx => idx + 1).join(', ');
}

// Применение новой последовательности
function applyNewSequence() {
  const inputValue = sequenceInput.value.trim();
  
  if (!inputValue) {
    showNotification('❌ Введите последовательность', 'error');
    return;
  }
  
  try {
    // Парсим введенную последовательность
    const numbers = inputValue.split(',').map(s => {
      const num = parseInt(s.trim());
      if (isNaN(num) || num < 1 || num > pointMarkers.length) {
        throw new Error(`Некорректный номер точки: ${s.trim()}`);
      }
      return num - 1; // Преобразуем в индекс (начиная с 0)
    });
    
    // Проверяем, что все точки уникальны
    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== numbers.length) {
      throw new Error('Есть повторяющиеся точки');
    }
    
    // Проверяем, что все точки присутствуют
    if (uniqueNumbers.size !== pointMarkers.length) {
      throw new Error('Не все точки указаны в последовательности');
    }
    
    // Применяем новую последовательность
    if (updateSequence(numbers)) {
      updateSequenceDisplay();
      closeSequenceEditor();
      showNotification('✅ Последовательность обновлена', 'success');
    } else {
      throw new Error('Не удалось обновить последовательность');
    }
  } catch (error) {
    showNotification(`❌ Ошибка: ${error.message}`, 'error');
  }
}

// Показать уведомление
function showNotification(message, type = 'info') {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
    status.className = type === 'error' ? 'error' : type === 'success' ? 'success' : '';
    
    setTimeout(() => {
      status.textContent = '';
      status.className = '';
    }, 3000);
  }
}

// Экспорт функций
export { updateSequenceDisplay as refreshSequenceDisplay };

