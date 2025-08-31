/**
 * Главный модуль приложения
 * Инициализирует все компоненты и связывает их между собой
 */

import { initMap, pointMarkers, getSelectedBounds, getStartPoint } from './modules/mapModule.js';
import { initNavigation } from './modules/navigation.js';
import { generatePoints, cancelPointGeneration, downloadGPX } from './modules/pointGeneration.js';

// DOM элементы (будут инициализированы в initApp)
let generateBtn, pointsInput, status, minDistPercentInput, cancelBtn, downloadGpxBtn;

// Инициализация приложения
export function initApp() {
  console.log('Инициализация приложения...');
  
  // Инициализируем DOM элементы
  generateBtn = document.getElementById('generateBtn');
  pointsInput = document.getElementById('pointsCount');
  status = document.getElementById('status');
  minDistPercentInput = document.getElementById('minDistPercent');
  cancelBtn = document.getElementById('cancelBtn');
  downloadGpxBtn = document.getElementById('downloadGpxBtn');
  
  // Проверяем наличие всех элементов
  if (!generateBtn || !pointsInput || !status || !minDistPercentInput || !cancelBtn || !downloadGpxBtn) {
    console.error('Не найдены необходимые DOM элементы');
    console.error('generateBtn:', !!generateBtn);
    console.error('pointsInput:', !!pointsInput);
    console.error('status:', !!status);
    console.error('minDistPercentInput:', !!minDistPercentInput);
    console.error('cancelBtn:', !!cancelBtn);
    console.error('downloadGpxBtn:', !!downloadGpxBtn);
    return;
  }
  
  // Инициализируем модули
  initMap();
  initNavigation();
  
  // Настраиваем обработчики событий
  setupEventHandlers();
  
  // Экспорт для глобального доступа (временно, для совместимости)
  updateGlobalVars();
  setInterval(updateGlobalVars, 1000); // Обновляем каждую секунду
  
  console.log('Приложение инициализировано');
}

// Настройка обработчиков событий
function setupEventHandlers() {
  // Обработчик кнопки генерации
  generateBtn.addEventListener('click', handleGenerateClick);
  
  // Обработчик кнопки отмены
  cancelBtn.addEventListener('click', handleCancelClick);
  
  // Обработчик кнопки скачивания GPX
  downloadGpxBtn.addEventListener('click', handleDownloadGPX);
}

// Обработчик клика по кнопке генерации
async function handleGenerateClick() {
  const count = parseInt(pointsInput.value, 10);
  const percent = parseFloat(minDistPercentInput.value);
  
  // Получаем текущие значения из mapModule
  const selectedBounds = getSelectedBounds();
  const startPoint = getStartPoint();
  
  await generatePoints(
    selectedBounds,
    startPoint,
    count,
    percent,
    updateStatus,
    toggleGenerateButton,
    toggleCancelButton
  );
}

// Обработчик клика по кнопке отмены
function handleCancelClick() {
  cancelPointGeneration();
  updateStatus('Отмена...');
  console.log('Генерация отменена пользователем.');
}

// Обработчик скачивания GPX
function handleDownloadGPX() {
  downloadGPX();
}

// Функции для управления UI
function updateStatus(message) {
  if (status) {
    status.textContent = message;
  }
}

function toggleGenerateButton(disabled) {
  if (generateBtn) {
    generateBtn.disabled = disabled;
  }
}

function toggleCancelButton(show) {
  if (cancelBtn) {
    cancelBtn.style.display = show ? 'inline-block' : 'none';
  }
}

// Функция для обновления глобальных переменных
function updateGlobalVars() {
  window.pointMarkers = pointMarkers;
  window.startPoint = getStartPoint();
}

// Автоматическая инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', initApp); 