# 🤖 Руководство для AI

## 🚨 КРИТИЧЕСКИ ВАЖНО

### ❌ НИКОГДА НЕ СОЗДАВАЙТЕ:
- `module_fixed.js`, `module_new.js`, `module_advanced.js`, `module_simple.js`, `module_backup.js`, `module_unified.js`

### ❌ НИКОГДА НЕ ДУБЛИРУЙТЕ КОД:
- **DRY принцип**: код должен существовать в ОДНОМ месте
- **API консистентность**: сервер и клиент должны использовать одинаковые структуры данных

### ✅ ВСЕГДА:
- Редактируйте существующие модули напрямую
- Коммитьте изменения: `git add src/modules/module.js && git commit -m "Description"`
- Push и deploy: `git push && python deploy_regru.py`

## 📁 Структура модулей
```
src/modules/
├── app.js                    # Главный модуль
├── mapModule.js              # Карта и визуализация
├── navigation.js             # Навигация
├── pointGeneration.js        # Генерация точек
├── optimizedOverpassAPI.js   # OSM данные
└── ...
```

## 🎯 Принципы качества
- **DRY**: Don't Repeat Yourself
- **KISS**: Keep It Simple, Stupid
- **Single Responsibility**: один модуль = одна задача