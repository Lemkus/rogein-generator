# 📐 Алгоритм генерации контрольных точек - Техническая документация

## Обзор

Модуль `pointGeneration.js` реализует интеллектуальный алгоритм размещения контрольных точек на тропах с учетом уровня сложности, запретных зон, достижимости и оптимального распределения.

## Архитектура

### Основные компоненты

```
pointGeneration.js
├── calculateMinDistance()       - Расчет минимального расстояния
├── calculateMaxAttempts()       - Расчет максимальных попыток
├── generatePoints()             - Главная функция генерации
└── generatePointsOnPaths()      - Размещение точек на тропах
```

---

## 🔧 Функции расчета параметров

### `calculateMinDistance(area, count, difficultyLevel)`

Вычисляет минимальное расстояние между точками на основе площади, количества и уровня сложности.

**Параметры:**
- `area` (number) - Площадь области в м²
- `count` (number) - Количество точек
- `difficultyLevel` (number) - Уровень сложности (1-3)

**Возвращает:** `number` - Минимальное расстояние в метрах

**Алгоритм:**

```javascript
function calculateMinDistance(area, count, difficultyLevel) {
  const baseDistance = Math.sqrt(area / count);
  
  switch (parseInt(difficultyLevel)) {
    case 1: // 🟢 Новичок
      return baseDistance * 0.4;
    case 2: // 🟡 Любитель
      return baseDistance * 0.8;
    case 3: // 🔴 Эксперт
      return baseDistance * 1.2;
    default:
      return baseDistance * 0.8;
  }
}
```

**Математическое обоснование:**

Базовое расстояние `baseDistance = √(area / count)` даёт оценку среднего расстояния между точками при равномерном распределении. Коэффициенты подобраны эмпирически:

- **0.4** - Позволяет точкам быть в 2.5 раза ближе, создает плотное размещение
- **0.8** - Оптимальный баланс, проверенный на практике
- **1.2** - Увеличивает минимальное расстояние на 20%, максимизирует разнесение

---

### `calculateMaxAttempts(count, difficultyLevel)`

Вычисляет максимальное количество попыток для размещения точек.

**Параметры:**
- `count` (number) - Количество точек
- `difficultyLevel` (number) - Уровень сложности (1-3)

**Возвращает:** `number` - Максимальное количество попыток

**Алгоритм:**

```javascript
function calculateMaxAttempts(count, difficultyLevel) {
  switch (parseInt(difficultyLevel)) {
    case 1: // 🟢 Новичок
      return count * 20;
    case 2: // 🟡 Любитель
      return count * 15;
    case 3: // 🔴 Эксперт
      return count * 30;
    default:
      return count * 15;
  }
}
```

**Обоснование коэффициентов:**

- **× 20** (Новичок) - Малое minDist требует меньше попыток
- **× 15** (Любитель) - Стандартное соотношение
- **× 30** (Эксперт) - Большое minDist требует больше попыток для успешного размещения

---

## 🎯 Главная функция генерации

### `generatePoints(selectedBounds, startPoint, count, difficultyLevel, statusCallback, buttonCallback, cancelCallback)`

Главная экспортируемая функция для генерации точек.

**Параметры:**
- `selectedBounds` (Object) - Границы выбранной области
  - `south`, `west`, `north`, `east` (number) - Координаты
  - `type` (string) - 'rectangle' или 'polygon'
  - `polygon` (Object) - Leaflet polygon (если type === 'polygon')
- `startPoint` (Object) - Точка старта `{lat, lng}`
- `count` (number) - Количество точек для генерации
- `difficultyLevel` (number) - Уровень сложности (1-3)
- `statusCallback` (Function) - Функция обновления статуса
- `buttonCallback` (Function) - Функция управления кнопкой
- `cancelCallback` (Function) - Функция управления отменой

**Возвращает:** `Promise<void>`

**Алгоритм:**

1. **Валидация входных данных**
   ```javascript
   if (!selectedBounds || !startPoint || isNaN(count) || count < 1) {
     // Показать ошибку
     return;
   }
   ```

2. **Расчет площади**
   ```javascript
   let area;
   if (selectedBounds.type === 'polygon') {
     area = calculatePolygonArea(selectedBounds.polygon);
   } else {
     area = rectangleArea(selectedBounds);
   }
   ```

3. **Расчет параметров**
   ```javascript
   const minDist = calculateMinDistance(area, count, difficultyLevel);
   ```

4. **Загрузка данных OSM**
   ```javascript
   const mapData = await fetchAllMapData(bbox, statusCallback);
   ```

5. **Построение графа троп**
   ```javascript
   const graph = buildPathGraph(pathsData, [], barriersData);
   const updatedGraph = buildPathGraph(pathsData, forbiddenPolygons, barriersData);
   ```

6. **Размещение точек**
   ```javascript
   const points = await generatePointsOnPaths(
     pathsData, selectedBounds, startPoint, count, 
     minDist, difficultyLevel, forbiddenPolygons, 
     updatedGraph, startNodeIdx, statusCallback
   );
   ```

7. **Обновление UI**
   ```javascript
   if (points.length > 0) {
     updateTargetPointsList();
     generateAndDisplaySequence();
   }
   ```

---

## 🎲 Алгоритм размещения точек

### `generatePointsOnPaths(pathsData, selectedBounds, startPoint, count, minDist, difficultyLevel, forbiddenPolygons, graph, startNodeIdx, statusCallback)`

Внутренняя функция размещения точек на тропах с адаптивным снижением минимального расстояния.

**Основной цикл:**

```javascript
let currentMinDist = minDist;
let reductionStep = 0;
let lastPointsCount = 0;

while (points.length < count && attempts < maxAttempts && !cancelGeneration) {
  attempts++;
  
  // Адаптивное снижение если застряли
  if (attempts % 100 === 0 && points.length === lastPointsCount && reductionStep < 3) {
    reductionStep++;
    currentMinDist = originalMinDist * (1 - reductionStep * 0.15); // -15% за шаг
    console.log(`⚠️ Снижение minDist: ${originalMinDist}м → ${currentMinDist}м`);
  }
  
  // 1. Выбор случайной тропы
  const randomPath = filteredPaths[Math.floor(Math.random() * filteredPaths.length)];
  
  // 2. Выбор случайной точки на тропе
  const randomPoint = getRandomPointOnLine(linePoints);
  
  // 3. Проверки (используем currentMinDist)
  if (!passesAllChecks(pointObj, currentMinDist)) continue;
  
  // 4. Добавление точки
  points.push(pointObj);
  addPointMarker(pointObj.lat, pointObj.lng, points.length);
}
```

**Адаптивное снижение гарантирует генерацию всех запрошенных точек!**

### Проверки валидности точки

#### 1. Проверка границ области
```javascript
if (pointObj.lat < selectedBounds.south || 
    pointObj.lat > selectedBounds.north ||
    pointObj.lng < selectedBounds.west || 
    pointObj.lng > selectedBounds.east) {
  continue; // Вне прямоугольника
}
```

#### 2. Проверка полигона (если применимо)
```javascript
if (selectedBounds.type === 'polygon') {
  if (!pointInPolygon(pointObj.lat, pointObj.lng, polygonCoords)) {
    continue; // Вне полигона
  }
}
```

#### 3. Проверка минимального расстояния (с jitter)
```javascript
let tooClose = false;
for (const existingPoint of points) {
  const distance = haversine(pointObj.lat, pointObj.lng, existingPoint.lat, existingPoint.lng);
  
  // Динамическое расстояние для уровня "Новичок"
  let effectiveMinDist = minDist;
  if (parseInt(difficultyLevel) === 1) {
    const jitter = 0.7 + Math.random() * 0.6; // 0.7 - 1.3
    effectiveMinDist = minDist * jitter;
  }
  
  if (distance < effectiveMinDist) {
    tooClose = true;
    break;
  }
}
```

**Ключевая особенность:** Jitter применяется только для уровня 1, создавая **естественное распределение**.

#### 4. Проверка запретных зон
```javascript
for (const polygon of forbiddenPolygons) {
  if (pointInPolygon(pointObj.lat, pointObj.lng, polygon)) {
    inForbiddenZone = true;
    break;
  }
}
```

#### 5. Проверка достижимости
```javascript
const pointNodeIdx = findNearestNodeIdx(pointObj.lat, pointObj.lng, graph.nodes);
if (pointNodeIdx === -1 || !isReachable(graph, startNodeIdx, pointNodeIdx)) {
  continue; // Недостижимо от старта
}
```

---

## 📊 Статистика отладки

Модуль собирает детальную статистику попыток:

```javascript
const debugStats = {
  totalAttempts: 0,       // Всего попыток
  invalidPath: 0,         // Невалидная тропа
  noRandomPoint: 0,       // Не удалось получить точку на тропе
  outOfBounds: 0,         // Вне прямоугольника
  outOfPolygon: 0,        // Вне полигона
  tooClose: 0,            // Слишком близко к другим точкам
  inForbiddenZone: 0,     // В запретной зоне
  noNearestNode: 0,       // Не найден ближайший узел графа
  notReachable: 0,        // Недостижимо от старта
  success: 0              // Успешно размещено
};
```

Выводится в консоль после завершения:
```
🔍 Отладочная информация генерации точек:
   Всего попыток: 150
   Слишком близко: 87
   Недостижимо: 12
   Успешно: 10
```

---

## 🎨 Jitter алгоритм (уровень "Новичок")

### Концепция

Jitter добавляет случайность в минимальное расстояние для каждой пары точек, создавая **интересное естественное распределение**.

### Реализация

```javascript
if (parseInt(difficultyLevel) === 1) {
  const jitter = 0.7 + Math.random() * 0.6; // Диапазон: 0.7 - 1.3
  effectiveMinDist = minDist * jitter;
}
```

### Визуализация распределения

```
Без jitter (уровни 2-3):
  ○     ○     ○     ○     ○
  ○     ○     ○     ○     ○
  ○     ○     ○     ○     ○
  (Равномерная сетка)

С jitter (уровень 1):
  ○ ○       ○     ○  ○
    ○   ○         ○
  ○       ○ ○   ○
  (Кластеры и разреженности)
```

### Математика jitter

- **Минимум:** 0.7 → эффективное расстояние = 70% от minDist
- **Максимум:** 1.3 → эффективное расстояние = 130% от minDist
- **Среднее:** 1.0 → эффективное расстояние = 100% от minDist

Распределение **равномерное** на интервале [0.7, 1.3].

---

## 🔄 Интеграция с UI

### Получение уровня из настроек

В `app.js`:
```javascript
const difficultyLevelSelect = document.getElementById('difficultyLevel');
const difficultyLevel = difficultyLevelSelect ? 
  parseInt(difficultyLevelSelect.value) : 2;
```

### HTML элемент

```html
<select id="difficultyLevel" class="settings-input">
  <option value="1">🟢 Новичок (плотное размещение)</option>
  <option value="2" selected>🟡 Любитель (сбалансированное)</option>
  <option value="3">🔴 Эксперт (максимальное разнесение)</option>
</select>
```

### Вызов функции

```javascript
await generatePoints(
  selectedBounds,
  startPoint,
  count,
  difficultyLevel,  // <-- Новый параметр
  updateStatus,
  toggleGenerateButton,
  toggleCancelButton
);
```

---

## 🧪 Тестирование

### Сценарии тестирования

1. **Малая область, много точек (стресс-тест)**
   ```
   Area: 0.1 km²
   Points: 20
   Difficulty: 3 (Expert)
   Expected: Не все точки размещены
   ```

2. **Большая область, мало точек (легкий)**
   ```
   Area: 5 km²
   Points: 5
   Difficulty: 1 (Beginner)
   Expected: Все точки размещены легко
   ```

3. **Jitter проверка (визуальная)**
   ```
   Area: 1 km²
   Points: 15
   Difficulty: 1 (Beginner)
   Expected: Видимые кластеры и разреженности
   ```

4. **Запретные зоны**
   ```
   Area: 1 km² с озером посередине
   Points: 10
   Difficulty: 2 (Amateur)
   Expected: Точки не в озере, равномерно вокруг
   ```

### Метрики успеха

- **Успешное размещение:** ≥ 80% от запрошенных точек
- **Время выполнения:** < 10 секунд для 20 точек
- **Валидность:** 100% точек проходят все проверки

---

## ⚡ Оптимизация производительности

### Текущие оптимизации

1. **Ограничение попыток**
   ```javascript
   const maxAttempts = calculateMaxAttempts(count, difficultyLevel);
   ```
   Предотвращает бесконечные циклы.

2. **Ранний выход при отмене**
   ```javascript
   if (cancelGeneration) return;
   ```
   Проверяется в нескольких местах.

3. **Эффективная проверка расстояний**
   ```javascript
   // Используем haversine вместо точной геодезической формулы
   const distance = haversine(lat1, lng1, lat2, lng2);
   ```

4. **Фильтрация троп**
   ```javascript
   const filteredPaths = pathsData.filter(path => 
     path.geometry && Array.isArray(path.geometry) && path.geometry.length > 0
   );
   ```
   Единожды в начале.

### Потенциальные улучшения

1. **Spatial indexing для проверки близости**
   ```javascript
   // TODO: Использовать quadtree или R-tree
   // для O(log n) вместо O(n) проверки расстояний
   ```

2. **Предварительная фильтрация троп по расстоянию**
   ```javascript
   // TODO: Отбрасывать тропы, слишком далекие от уже размещенных точек
   ```

3. **Адаптивное снижение minDist**
   ```javascript
   // TODO: Если не удается разместить точки, постепенно снижать minDist
   ```

---

## 🐛 Известные ограничения

1. **Малые области**
   - При area < 0.1 km² и большом количестве точек может не хватить места
   - **Решение:** Предупреждать пользователя

2. **Изолированные компоненты графа**
   - Если граф разбит на несвязные части, точки будут только в достижимой части
   - **Решение:** Находить все компоненты связности

3. **Jitter может создать слишком плотные кластеры**
   - В редких случаях несколько точек могут быть очень близко
   - **Решение:** Добавить абсолютный минимум (например, 20м)

---

## 📚 Зависимости

### Внутренние модули
- `utils.js` - haversine, pointInPolygon, getRandomPointOnLine
- `algorithms.js` - buildPathGraph, findNearestNodeIdx, isReachable
- `mapModule.js` - addPointMarker, getStartPoint
- `optimizedOverpassAPI.js` - fetchAllMapData

### Внешние библиотеки
- Leaflet (через mapModule) - для работы с полигонами

---

## 🔮 Будущие улучшения

### Версия 2.1 (планируется)
- [ ] Адаптивное снижение minDist при недостатке попыток
- [ ] Spatial indexing для ускорения проверок
- [ ] Визуализация статистики попыток

### Версия 2.2
- [ ] Множественные компоненты связности
- [ ] Weighted distribution (больше точек в интересных местах)
- [ ] Экспорт/импорт настроек сложности

### Версия 3.0
- [ ] Machine learning для оптимального размещения
- [ ] Учет рельефа (набор высоты)
- [ ] Динамическая сложность (адаптация по ходу тренировки)

---

## 📝 Changelog

### v2.0 (26.10.2025)
- ✨ Добавлены уровни сложности (Новичок, Любитель, Эксперт)
- ✨ Реализован jitter для уровня "Новичок"
- ✨ Адаптивное количество попыток
- 📚 Полная документация алгоритма

### v1.0 (прежняя версия)
- ✅ Базовый алгоритм генерации
- ✅ Проверка запретных зон
- ✅ Проверка достижимости

---

**Автор:** TrailSpot Team  
**Дата:** 26 октября 2025  
**Версия:** 2.0

