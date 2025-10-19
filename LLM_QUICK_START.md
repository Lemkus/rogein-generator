# 🤖 Быстрый старт для LLM

## 🚨 ПРИ НОВОЙ ЗАДАЧЕ - ПРОЧИТАЙТЕ ЭТИ ФАЙЛЫ:

### 1. **ОБЯЗАТЕЛЬНО (в порядке приоритета):**
```
docs/development/AI_DEVELOPMENT_GUIDE.md    # Основные правила
docs/architecture/PROJECT_ARCHITECTURE.md   # Структура проекта
docs/llm/LLM_INSTRUCTIONS.md               # Инструкции для LLM
```

### 2. **ДОПОЛНИТЕЛЬНО (по необходимости):**
```
docs/llm/LLM_STARTUP_GUIDE.md              # Руководство по запуску
docs/development/DEVELOPMENT_CONTEXT.md     # Контекст разработки
docs/llm/QUICK_CONTEXT_TEMPLATES.md        # Шаблоны контекста
```

## 🎯 Быстрый чеклист

### Перед началом работы:
- [ ] Прочитал `docs/development/AI_DEVELOPMENT_GUIDE.md`
- [ ] Прочитал `docs/architecture/PROJECT_ARCHITECTURE.md`
- [ ] Прочитал `docs/llm/LLM_INSTRUCTIONS.md`
- [ ] Понял, какой модуль нужно изменить
- [ ] Убедился, что не буду создавать новые файлы

### При изменении кода:
- [ ] Редактирую существующий модуль
- [ ] Тестирую изменения
- [ ] Коммичу: `git add src/modules/module.js && git commit -m "Описание"`
- [ ] Деплою: `python deploy_regru.py`

## 🚨 КРИТИЧЕСКИ ВАЖНО

### ❌ **НИКОГДА НЕ СОЗДАВАЙТЕ:**
- `module_fixed.js`, `module_new.js`, `module_advanced.js`
- MD файлы в корне проекта
- Временные файлы

### ✅ **ВСЕГДА ДЕЛАЙТЕ:**
- Редактируйте существующие модули
- Создавайте MD файлы в `docs/` по категориям
- Коммитьте и деплойте изменения

## 📁 Структура проекта (краткая)

```
src/modules/
├── app.js                    # Главный модуль
├── mapModule.js              # Карта и визуализация
├── navigation.js             # Основная логика навигации
├── fullscreenNavigation.js   # UI полноэкранного режима
├── pointGeneration.js        # Генерация точек
├── routeSequence.js          # Оптимизация маршрута
├── sequenceUI.js             # Управление последовательностью
├── storageAPI.js             # Сохранение маршрутов
├── optimizedOverpassAPI.js   # Загрузка данных OSM
├── serverOverpassAPI.js      # Серверный прокси
├── audioModuleAdvanced.js    # Звуковые сигналы
└── mediaSessionManager.js    # Управление медиа
```

## 🔄 Workflow

1. **Редактировать** существующий модуль
2. **Тестировать** изменения
3. **Коммитить**: `git add src/modules/module.js && git commit -m "Описание"`
4. **Деплоить**: `python deploy_regru.py`

## 📚 Документация

Все документация в папке `docs/`:
- **`docs/README.md`** - главная документация
- **`docs/architecture/`** - архитектура проекта
- **`docs/development/`** - правила разработки
- **`docs/llm/`** - инструкции для LLM
- **`docs/user/`** - документация для пользователей

**ЦЕЛЬ:** Поддерживать чистую, понятную структуру проекта без избыточности.
