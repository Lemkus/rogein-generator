# 🚀 Руководство по запуску для LLM

## 🎯 Что делать при новой задаче

### 1. **СНАЧАЛА прочитайте эти файлы (в порядке приоритета):**

```bash
# ОБЯЗАТЕЛЬНО - основные правила
docs/development/AI_DEVELOPMENT_GUIDE.md

# ОБЯЗАТЕЛЬНО - структура проекта  
docs/architecture/PROJECT_ARCHITECTURE.md

# ОБЯЗАТЕЛЬНО - инструкции для LLM
docs/llm/LLM_INSTRUCTIONS.md

# ДОПОЛНИТЕЛЬНО - контекст разработки
docs/development/DEVELOPMENT_CONTEXT.md

# ДОПОЛНИТЕЛЬНО - шаблоны контекста
docs/llm/QUICK_CONTEXT_TEMPLATES.md
```

### 2. **Определите тип задачи и используйте соответствующие шаблоны:**

#### 🔧 **Для задач разработки:**
- Читайте `docs/development/AI_DEVELOPMENT_GUIDE.md`
- Следуйте правилам из `docs/development/DEVELOPMENT_RULES.md`
- Используйте шаблоны из `docs/llm/QUICK_CONTEXT_TEMPLATES.md`

#### 🏗️ **Для задач архитектуры:**
- Читайте `docs/architecture/PROJECT_ARCHITECTURE.md`
- Изучите зависимости модулей
- Используйте стратегии выбора контекста

#### 🐛 **Для исправления багов:**
- Читайте `docs/development/AI_DEVELOPMENT_GUIDE.md`
- Определите, какой модуль нужно изменить
- НЕ создавайте новые файлы!

#### ✨ **Для добавления функций:**
- Читайте `docs/development/AI_DEVELOPMENT_GUIDE.md`
- Определите, в какой модуль добавить функцию
- НЕ создавайте новые модули!

## 🚨 КРИТИЧЕСКИ ВАЖНО

### ❌ **НИКОГДА НЕ СОЗДАВАЙТЕ:**
- `module_fixed.js`
- `module_new.js`
- `module_advanced.js`
- `module_simple.js`
- `module_backup.js`
- `module_unified.js`

### ✅ **ВСЕГДА ДЕЛАЙТЕ:**
- Редактируйте существующие модули
- Коммитьте изменения сразу
- Запускайте деплой: `python deploy_regru.py`

## 📋 Быстрый чеклист

### Перед началом работы:
- [ ] Прочитал `docs/development/AI_DEVELOPMENT_GUIDE.md`
- [ ] Прочитал `docs/architecture/PROJECT_ARCHITECTURE.md`
- [ ] Прочитал `docs/llm/LLM_INSTRUCTIONS.md`
- [ ] Понял, какой модуль нужно изменить
- [ ] Убедился, что не буду создавать новые файлы

### При изменении кода:
- [ ] Редактирую существующий модуль
- [ ] Тестирую изменения
- [ ] Коммичу изменения: `git add src/modules/module.js && git commit -m "Описание"`
- [ ] Запускаю деплой: `python deploy_regru.py`

### После завершения:
- [ ] Обновил документацию при необходимости
- [ ] Проверил, что все работает
- [ ] Убедился, что не создал избыточных файлов

## 🎯 Структура проекта (краткая справка)

### **Активные модули:**
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

### **Workflow:**
1. Редактировать модуль
2. Тестировать
3. Коммитить: `git add src/modules/module.js && git commit -m "Описание"`
4. Деплоить: `python deploy_regru.py`

## 💡 Памятка

**ПОМНИТЕ:** 
- Git создан для контроля версий
- Не нужно создавать множественные версии файлов
- Простой workflow: редактировать → коммитить → деплоить
- Всегда читайте инструкции перед началом работы

**ЦЕЛЬ:** Поддерживать чистую, понятную структуру проекта без избыточности.
