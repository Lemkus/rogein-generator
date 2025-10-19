# 📋 Правила разработки

## 🚫 ЗАПРЕЩЕНО
- Создавать новые модули с суффиксами (_fixed, _new, _advanced, _simple, _backup, _unified)
- Дублировать код в разных модулях
- Повторять запросы в серверном и клиентском коде

## ✅ РАЗРЕШЕНО
- Редактировать существующие модули напрямую
- Использовать DRY принцип - код в ОДНОМ месте
- Коммитить изменения сразу: `git add src/modules/module.js && git commit -m "Description"`
- Push и deploy: `git push && python deploy_regru.py`

## 🎯 Принципы качества
- **DRY**: Don't Repeat Yourself
- **KISS**: Keep It Simple, Stupid  
- **YAGNI**: You Aren't Gonna Need It
- **Single Responsibility**: один модуль = одна задача
- **Fail Fast**: обрабатывайте ошибки рано

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