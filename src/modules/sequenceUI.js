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
  
  // Проверка наличия элементов
  if (!sequenceSection || !sequenceLink || !routeStatsSpan || !toggleDirectionBtn) {
    console.error('Не найдены необходимые DOM элементы для последовательности');
    return false;
  }
  
  // Установка обработчиков
  setupEventHandlers();
  
  console.log('✅ UI последовательности инициализирован');
  return true;
}

// Настройка обработчиков событий
function setupEventHandlers() {
  // Клик по ссылке последовательности - открыть редактор
  sequenceLink.addEventListener('click', (e) => {
    e.preventDefault();
    openSequenceEditor();
  });
  
  // Кнопка смены направления
  toggleDirectionBtn.addEventListener('click', () => {
    const isClockwise = toggleDirection();
    updateSequenceDisplay();
    
    // Показываем уведомление
    const direction = isClockwise ? 'по часовой' : 'против часовой';
    showNotification(`🔄 Направление изменено: ${direction}`);
  });
  
  // Закрытие модального окна
  sequenceModalClose.addEventListener('click', closeSequenceEditor);
  sequenceModal.addEventListener('click', (e) => {
    if (e.target === sequenceModal) closeSequenceEditor();
  });
  
  // Применение новой последовательности
  applySequenceBtn.addEventListener('click', applyNewSequence);
  
  // Enter в поле ввода
  sequenceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      applyNewSequence();
    }
  });
}

// Генерация и отображение последовательности
export function generateAndDisplaySequence() {
  if (!pointMarkers || pointMarkers.length === 0) {
    hideSequenceSection();
    return;
  }
  
  // Генерируем оптимальную последовательность
  const sequence = generateOptimalSequence();
  
  if (sequence.length === 0) {
    hideSequenceSection();
    return;
  }
  
  // Отображаем последовательность
  updateSequenceDisplay();
  showSequenceSection();
  
  console.log('✅ Последовательность сгенерирована и отображена');
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
  sequenceLink.textContent = `СТАРТ → ${sequenceText} → СТАРТ`;
  
  // Обновляем статистику маршрута
  const stats = getRouteStats();
  if (stats) {
    const distanceKm = (stats.totalDistance / 1000).toFixed(2);
    routeStatsSpan.textContent = `${distanceKm} км, ${stats.direction}`;
  }
  
  // Обновляем текст кнопки направления
  const isClockwise = getDirection();
  toggleDirectionBtn.innerHTML = isClockwise ? '🔄 Против часовой' : '🔄 По часовой';
}

// Показать секцию последовательности
function showSequenceSection() {
  if (sequenceSection) {
    sequenceSection.style.display = 'block';
  }
}

// Скрыть секцию последовательности
function hideSequenceSection() {
  if (sequenceSection) {
    sequenceSection.style.display = 'none';
  }
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

