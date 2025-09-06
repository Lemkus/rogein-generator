# 🗺️ Генератор точек на тропах OSM

**Генератор контрольных точек на тропах OpenStreetMap с звуковой навигацией для рогейна**

[![Deploy to GitHub Pages](https://github.com/[USERNAME]/rogein-generator/actions/workflows/deploy.yml/badge.svg)](https://github.com/[USERNAME]/rogein-generator/actions/workflows/deploy.yml)

## 🌐 Живая версия

**[Открыть приложение](https://[USERNAME].github.io/rogein-generator/)**

## 📱 Установка на телефон

### Android (Chrome):
1. Откройте приложение в Chrome
2. Нажмите меню (три точки) → "Добавить на главный экран"
3. Разрешите доступ к геолокации и уведомлениям

### iPhone (Safari):
1. Откройте приложение в Safari
2. Нажмите "Поделиться" → "На экран «Домой»"
3. Разрешите доступ к геолокации

## 🎯 Как использовать

1. **Выберите область** - нарисуйте прямоугольник на карте
2. **Установите старт** - добавьте маркер точки старта
3. **Сгенерируйте точки** - нажмите кнопку генерации
4. **Навигация** - выберите цель и следуйте вибрации:
   - 🔥 Короткие частые вибрации = очень близко (< 20м)
   - 🔥 Средние вибрации = близко (20-100м)
   - ❄️ Длинные редкие вибрации = далеко (> 200м)
   - 🎯 Особая вибрация = цель достигнута!

## ✨ Возможности

- 🗺️ **Интерактивная карта** OpenStreetMap
- 🎯 **Вибро-навигация** "Горячо-Холодно"
- 📍 **GPS-отслеживание** в реальном времени
- 📱 **PWA** - работает как нативное приложение
- 🔔 **Уведомления** о достижении точек
- 📊 **GPX экспорт** для Garmin устройств
- 🌲 **Офлайн-режим** после первой загрузки

## 🛠️ Технологии

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Карты**: Leaflet.js + OpenStreetMap
- **Геолокация**: Web Geolocation API
- **PWA**: Service Workers, Web App Manifest
- **Вибрация**: Vibration API
- **Уведомления**: Web Notifications API

## 🚀 Быстрый старт

1. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/[USERNAME]/rogein-generator.git
   cd rogein-generator
   ```

2. **Запустите локально:**
   ```bash
   python -m http.server 8000
   ```

3. **Откройте в браузере:**
   ```
   http://localhost:8000
   ```

## 📁 Структура проекта

```
rogein-generator/
├── index.html              # Главная страница
├── manifest.json           # PWA манифест
├── sw.js                  # Service Worker
├── src/
│   ├── app.js             # Основной модуль
│   └── modules/
│       ├── mapModule.js   # Работа с картой
│       ├── navigation.js  # Вибро-навигация
│       ├── pointGeneration.js # Генерация точек
│       ├── overpassAPI.js # API OSM
│       └── utils.js       # Утилиты
├── README.md              # Документация
└── MOBILE_SETUP.md        # Инструкция по мобильной установке
```

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🙏 Благодарности

- [OpenStreetMap](https://www.openstreetmap.org/) за картографические данные
- [Leaflet](https://leafletjs.com/) за библиотеку карт
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) за данные OSM

---

**Создано для любителей рогейна и ориентирования** 🧭
