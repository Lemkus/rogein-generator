# TrailSpot — Android Build Guide

## Архитектура

TrailSpot использует **Capacitor** для запуска существующего PWA-кода (HTML/JS) в нативной Android-оболочке. Это позволяет использовать нативные Android API:

| Проблема в браузере | Решение в Android |
|---|---|
| GPS замерзает при сворачивании | `BackgroundGeolocationService` (Foreground Service) |
| Wake Lock теряется | `FLAG_KEEP_SCREEN_ON` через KeepAwake plugin |
| AudioContext suspended | `capacitorResume` event → `audioContext.resume()` |
| JS-таймеры throttled | Нативный Foreground Service держит процесс живым |

## Структура

```
├── android/                  ← Нативный Android-проект (Gradle)
│   └── app/src/main/
│       ├── AndroidManifest.xml  ← Permissions + Foreground Service
│       └── java/.../MainActivity.java  ← onResume → capacitorResume event
├── www/                      ← Web-ресурсы (копия src/ для Capacitor)
├── src/
│   ├── android/
│   │   ├── geolocationAdapter.js  ← GPS адаптер (Capacitor ↔ browser)
│   │   └── keepAwakeAdapter.js    ← Wake Lock адаптер
│   └── modules/
│       ├── navigation.js    ← использует адаптеры вместо browser API
│       └── audioModuleAdvanced.js  ← фоновое аудио + pending queue
├── capacitor.config.json     ← Capacitor конфиг (appId, webDir)
└── scripts/
    ├── sync-www.sh           ← Синхронизация src/ → www/
    └── build-android.sh      ← Сборка APK/AAB
```

## Быстрый старт

### Требования
- **Node.js** 18+
- **Android Studio** Hedgehog или новее
- **Android SDK** (API 24–36)
- **Java 17+** (`JAVA_HOME` должен быть задан)

### Установка зависимостей

```bash
npm install
```

### Открыть в Android Studio

```bash
./scripts/sync-www.sh   # синхронизирует src/ → www/
npx cap sync android    # обновляет Android-проект
npx cap open android    # открывает Android Studio
```

После открытия в Android Studio нажмите **▶ Run** для запуска на устройстве или эмуляторе.

### Собрать debug APK (без Android Studio)

```bash
./scripts/build-android.sh
# APK будет в android/app/build/outputs/apk/debug/
```

### Собрать release AAB для Google Play

```bash
export KEYSTORE_PATH=/path/to/your.keystore
export KEY_ALIAS=your_alias
export KEYSTORE_PASSWORD=your_password
./scripts/build-android.sh release
# AAB будет в android/app/build/outputs/bundle/release/
```

## Разрешения Android

| Разрешение | Зачем |
|---|---|
| `ACCESS_FINE_LOCATION` | Точный GPS |
| `ACCESS_COARSE_LOCATION` | Приблизительная локация (fallback) |
| `ACCESS_BACKGROUND_LOCATION` | GPS при заблокированном экране (Android 10+) |
| `FOREGROUND_SERVICE` | Фоновый сервис |
| `FOREGROUND_SERVICE_LOCATION` | Фоновый сервис с геолокацией (Android 14+) |
| `WAKE_LOCK` | CPU не засыпает пока навигация активна |
| `VIBRATE` | Вибрационные подсказки |

> **Важно для Google Play:** разрешение `ACCESS_BACKGROUND_LOCATION` требует отдельного обоснования при публикации. В форме деклараций укажите: "Приложение использует геолокацию в фоне для навигации по маршруту ориентирования".

## Обновление веб-кода

Когда вы изменяете файлы в `src/`:

```bash
./scripts/sync-www.sh && npx cap sync android
```

Затем пересоберите в Android Studio или через `./scripts/build-android.sh`.

## Отладка на устройстве

Включите **USB debugging** на устройстве, подключите кабель:

```bash
npx cap run android
```

Для отладки WebView откройте `chrome://inspect` в Chrome — вы увидите WebView приложения.
