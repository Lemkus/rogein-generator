#!/bin/bash
# Build TrailSpot Android APK / AAB
#
# Требования:
#   - Node.js 18+
#   - Android Studio с SDK (ANDROID_HOME или ANDROID_SDK_ROOT)
#   - Java 17+ (JAVA_HOME)
#
# Использование:
#   ./scripts/build-android.sh            # debug APK
#   ./scripts/build-android.sh release    # release AAB (требует keystore)

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_TYPE="${1:-debug}"

echo "=== TrailSpot Android Build ==="
echo "Тип сборки: $BUILD_TYPE"
echo "Корень проекта: $ROOT"
echo ""

# 0. Авто-setup при первом запуске (после клона репо)
if [ ! -d "$ROOT/node_modules" ] || [ ! -f "$ROOT/android/capacitor-cordova-android-plugins/cordova.variables.gradle" ]; then
    echo "[0/4] Первый запуск — выполняю setup..."
    "$ROOT/scripts/setup.sh"
fi

# 1. Синхронизируем исходники в www/
echo "[1/4] Синхронизация веб-ресурсов..."
"$ROOT/scripts/sync-www.sh"

# 2. Синхронизируем Capacitor плагины в Android-проект (генерирует
#    capacitor-cordova-android-plugins/ — обязательно для Gradle)
echo "[2/4] Capacitor sync..."
cd "$ROOT"
npx cap sync android

# 3. Gradle build
echo "[3/4] Gradle build ($BUILD_TYPE)..."
cd "$ROOT/android"

if [ "$BUILD_TYPE" = "release" ]; then
    if [ -z "$KEYSTORE_PATH" ] || [ -z "$KEY_ALIAS" ] || [ -z "$KEYSTORE_PASSWORD" ]; then
        echo "ERROR: Для release сборки нужны переменные окружения:"
        echo "  KEYSTORE_PATH=/path/to/keystore.jks"
        echo "  KEY_ALIAS=your_key_alias"
        echo "  KEYSTORE_PASSWORD=your_password"
        exit 1
    fi
    ./gradlew bundleRelease \
        -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
        -Pandroid.injected.signing.store.password="$KEYSTORE_PASSWORD" \
        -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \
        -Pandroid.injected.signing.key.password="${KEY_PASSWORD:-$KEYSTORE_PASSWORD}"
    echo ""
    echo "[4/4] Готово! AAB:"
    find "$ROOT/android/app/build/outputs/bundle" -name "*.aab"
else
    ./gradlew assembleDebug
    echo ""
    echo "[4/4] Готово! APK:"
    find "$ROOT/android/app/build/outputs/apk" -name "*.apk"
fi
