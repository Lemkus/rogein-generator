# 🏗️ Архитектура проекта RogeinProject (TrailSpot)

## 📋 Обзор
PWA для навигации по тропам с аудио-навигацией "Горячо-Холодно"

## 🔗 Карта зависимостей модулей (АКТУАЛЬНАЯ)

### ✅ Активно используемые модули

#### Ядро системы
```
app.js (главный модуль)
├── mapModule.js (карта и визуализация) ✅
├── navigation.js (аудио-навигация) ✅
├── pointGeneration.js (генерация точек) ✅
└── routeSequence.js (оптимизация маршрута) ✅
```

#### API слой
```
optimizedOverpassAPI.js (загрузка данных OSM + кэширование) ✅
└── serverOverpassAPI.js (серверный прокси) ✅
```

#### Аудио система
```
audioModuleAdvanced.js (основной аудио модуль) ✅
└── mediaSessionManager.js (управление медиа) ✅
```

#### UI компоненты
```
sequenceUI.js (управление последовательностью) ✅
├── fullscreenNavigation.js (полноэкранная навигация) ✅
└── storageAPI.js (сохранение маршрутов) ✅
```

#### Навигационная система
```
navigation.js (основная логика навигации) ✅
├── fullscreenNavigation.js (UI полноэкранного режима) ✅
├── audioModuleAdvanced.js (звуковые сигналы) ✅
└── mediaSessionManager.js (управление медиа) ✅
```

### ⚠️ Модули с ограниченным использованием

#### Устаревшие аудио модули
```
audioModule.js (базовый) - НЕ ИСПОЛЬЗУЕТСЯ
audioModuleSimple.js (Web Audio API) - только в audio-debug.html
audioModuleImproved.js (улучшенный) - только в improved-sounds-test.html
audioModuleTone.js (Tone.js) - НЕ ИСПОЛЬЗУЕТСЯ
```

#### ✅ УДАЛЕНЫ (объединены или заменены)
```
overpassAPI.js - удален, заменен на optimizedOverpassAPI.js
pointGeneration_simple.js - объединен в pointGeneration.js
pointGeneration_fixed.js - объединен в pointGeneration.js
```

#### Неиспользуемые модули
```
apiClient.js - НЕ ИСПОЛЬЗУЕТСЯ
osmnxAPI.js - НЕ ИСПОЛЬЗУЕТСЯ
config.js - НЕ ИСПОЛЬЗУЕТСЯ
algorithms.js - НЕ ИСПОЛЬЗУЕТСЯ напрямую
utils.js - НЕ ИСПОЛЬЗУЕТСЯ напрямую
```

## 🎯 Стратегии выбора контекста (ОБНОВЛЕННЫЕ)

### Для задач API:
- optimizedOverpassAPI.js + serverOverpassAPI.js + pointGeneration.js (~1,200 токенов)

### Для задач навигации:
- navigation.js + fullscreenNavigation.js + audioModuleAdvanced.js + mediaSessionManager.js (~2,200 токенов)

### Для задач генерации точек:
- pointGeneration.js + optimizedOverpassAPI.js + serverOverpassAPI.js (~1,400 токенов)

### Для задач карты:
- mapModule.js + pointGeneration.js (~1,500 токенов)

### Для задач последовательности:
- routeSequence.js + sequenceUI.js + storageAPI.js (~1,200 токенов)

### Для архитектурных изменений:
- app.js + все активные модули (~2,000 токенов)

## 🧹 Рекомендации по очистке проекта

### ✅ УДАЛЕНЫ (объединены или не используются):
- `overpassAPI.js` - удален, заменен на optimizedOverpassAPI.js
- `pointGeneration_simple.js` - объединен в pointGeneration.js
- `pointGeneration_fixed.js` - объединен в pointGeneration.js

### Модули для удаления (НЕ ИСПОЛЬЗУЮТСЯ):
- `audioModule.js` - заменен на audioModuleAdvanced.js
- `audioModuleTone.js` - не используется в основном приложении
- `apiClient.js` - не используется
- `osmnxAPI.js` - не используется
- `config.js` - не используется

### Модули для проверки:
- `algorithms.js` - может использоваться косвенно
- `utils.js` - может использоваться косвенно

## 🚨 ПРАВИЛА РАЗРАБОТКИ

### ❌ ЗАПРЕЩЕНО создавать новые модули:
- `module_fixed.js` - исправления в существующих модулях
- `module_new.js` - новые версии существующих модулей  
- `module_advanced.js` - улучшенные версии существующих модулей
- `module_simple.js` - упрощенные версии существующих модулей
- `module_backup.js` - резервные копии модулей
- `module_unified.js` - объединенные версии модулей

### ✅ ВСЕГДА редактируйте существующие модули:
- Используйте Git для контроля версий
- Коммитьте изменения сразу после редактирования
- Запускайте деплой после каждого коммита

### 📋 Workflow для изменений:
1. **Отредактируйте существующий модуль** (НЕ создавайте новый!)
2. **Протестируйте изменения**
3. **Закоммитьте**: `git commit -m "Описание изменений"`
4. **Запустите деплой**: `python deploy_regru.py`

**Подробнее:** См. `DEVELOPMENT_RULES.md` и `AI_DEVELOPMENT_GUIDE.md`

### Тестовые файлы:
- `audio-debug.html` - использует audioModuleSimple.js
- `improved-sounds-test.html` - использует audioModuleImproved.js

## 📝 Шаблоны промптов (ОБНОВЛЕННЫЕ)

### Точечная задача:
"Вот модуль X и связанные с ним Y, Z. Задача: ..."

### Системная задача:
"Вот архитектура проекта. Нужно изменить систему X, затронув модули Y, Z. Задача: ..."

### Задача очистки:
"Вот список неиспользуемых модулей. Удали их и обнови импорты если нужно."
