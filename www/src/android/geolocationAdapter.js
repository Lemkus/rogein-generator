/**
 * Geolocation Adapter
 *
 * In Android (Capacitor): uses BackgroundGeolocation plugin via the native
 * Capacitor bridge (window.Capacitor.Plugins) — runs as Android Foreground
 * Service so GPS keeps working with screen off or app backgrounded.
 *
 * In browser: falls back to navigator.geolocation.watchPosition.
 *
 * Usage:
 *   import { watchPosition, clearWatch } from './android/geolocationAdapter.js';
 *   const id = await watchPosition(onSuccess, onError, options);
 *   clearWatch(id);
 */

const isCapacitorNative = () =>
  typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

/**
 * Returns the BackgroundGeolocation plugin from the Capacitor bridge.
 * Available automatically when running inside the Capacitor WebView —
 * no imports or node_modules needed.
 */
function getBgGeo() {
  return window.Capacitor?.Plugins?.BackgroundGeolocation ?? null;
}

/**
 * Start watching position.
 * @returns {Promise<string|number>} watchId to pass to clearWatch()
 */
export async function watchPosition(onSuccess, onError, options = {}) {
  const bgGeo = isCapacitorNative() ? getBgGeo() : null;

  if (bgGeo) {
    try {
      const watcherId = await bgGeo.addWatcher(
        {
          backgroundMessage:
            'TrailSpot продолжает навигацию. Следуйте аудио-подсказкам.',
          backgroundTitle: 'Навигация активна',
          requestPermissions: true,
          stale: false,
          distanceFilter: 3,
        },
        (location, error) => {
          if (error) {
            if (error.code === 'NOT_AUTHORIZED') {
              onError({
                code: 1,
                message:
                  'Нет разрешения на геолокацию. ' +
                  'Откройте Настройки → Приложения → TrailSpot → Разрешения ' +
                  'и разрешите геолокацию "Всегда".',
              });
            } else {
              onError({ code: 2, message: error.message || 'GPS error' });
            }
            return;
          }

          onSuccess({
            coords: {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              altitude: location.altitude,
              altitudeAccuracy: location.altitudeAccuracy,
              heading: location.bearing,
              speed: location.speed,
            },
            timestamp: location.time,
          });
        }
      );

      console.log('[GeoAdapter] BackgroundGeolocation watcher started:', watcherId);
      return watcherId;
    } catch (err) {
      console.warn('[GeoAdapter] BackgroundGeolocation failed, using browser API:', err);
    }
  }

  // Browser fallback
  return navigator.geolocation.watchPosition(onSuccess, onError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 1000,
    ...options,
  });
}

/**
 * Stop watching position.
 * @param {string|number} watchId returned by watchPosition()
 */
export async function clearWatch(watchId) {
  if (watchId === null || watchId === undefined) return;

  const bgGeo = isCapacitorNative() ? getBgGeo() : null;

  if (bgGeo && typeof watchId === 'string') {
    try {
      await bgGeo.removeWatcher({ id: watchId });
      console.log('[GeoAdapter] BackgroundGeolocation watcher removed');
      return;
    } catch (err) {
      console.warn('[GeoAdapter] removeWatcher failed:', err);
    }
  }

  navigator.geolocation.clearWatch(watchId);
}
