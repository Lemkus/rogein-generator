#!/bin/bash
# Первая настройка проекта на новой машине.
# Запускается ОДИН РАЗ после клонирования репо.
#
#   git clone ...
#   cd rogein-generator
#   ./scripts/setup.sh
#
# После этого можно открывать Android Studio: npx cap open android

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== TrailSpot — first-time setup ==="
echo ""

# 1. Проверка Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js не найден. Установите Node.js 18+: https://nodejs.org/"
    exit 1
fi
NODE_VERSION="$(node -v)"
echo "[1/3] Node.js: $NODE_VERSION"

# 2. npm install
if [ ! -d "node_modules" ]; then
    echo "[2/3] Установка npm-зависимостей..."
    npm install
else
    echo "[2/3] node_modules уже существует, пропускаю npm install"
    echo "      (если нужно обновить — удалите node_modules и запустите снова)"
fi

# 3. cap sync — генерирует android/capacitor-cordova-android-plugins/
#    и копирует www/ в android/app/src/main/assets/public/
echo "[3/3] Capacitor sync (генерирует capacitor-cordova-android-plugins)..."
"$ROOT/scripts/sync-www.sh"
npx cap sync android

echo ""
echo "=== Готово! ==="
echo ""
echo "Дальше:"
echo "  - Открыть в Android Studio:    npx cap open android"
echo "  - Собрать debug APK:           ./scripts/build-android.sh"
echo "  - Собрать release AAB:         ./scripts/build-android.sh release"
