#!/bin/bash
# Sync source files to www/ before running `npx cap sync android`
# Run: ./scripts/sync-www.sh

set -e

WWW="$(dirname "$0")/../www"
ROOT="$(dirname "$0")/.."

echo "Syncing web assets to www/ ..."

mkdir -p "$WWW/src/modules"
mkdir -p "$WWW/src/android"
mkdir -p "$WWW/assets/icons"
mkdir -p "$WWW/libs/leaflet"

cp "$ROOT/index.html"    "$WWW/"
cp "$ROOT/sw.js"         "$WWW/"
cp "$ROOT/manifest.json" "$WWW/"
cp "$ROOT/favicon.svg"   "$WWW/"
cp "$ROOT/src/app.js"    "$WWW/src/"
cp "$ROOT/src/modules/"*.js "$WWW/src/modules/"
cp "$ROOT/src/android/"*.js "$WWW/src/android/" 2>/dev/null || true
cp "$ROOT/assets/trailspot_logo.svg" "$WWW/assets/" 2>/dev/null || true
cp "$ROOT/assets/icons/"* "$WWW/assets/icons/" 2>/dev/null || true
cp "$ROOT/libs/leaflet/"* "$WWW/libs/leaflet/" 2>/dev/null || true

echo "Done. Run 'npx cap sync android' to update the Android project."
