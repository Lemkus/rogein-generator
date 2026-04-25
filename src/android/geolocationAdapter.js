/**
 * Geolocation Adapter
 *
 * Detects whether the app is running inside a Capacitor Android shell.
 * - In Android: uses @capacitor-community/background-geolocation, which runs
 *   as an Android Foreground Service with a persistent notification, so GPS
 *   keeps working when the screen is off or the app is sent to background.
 * - In browser: falls back to the standard navigator.geolocation API.
 *
 * Usage (drop-in replacement for navigator.geolocation.watchPosition):
 *
 *   import { watchPosition, clearWatch } from './android/geolocationAdapter.js';
 *
 *   const watchId = await watchPosition(onPosition, onError, options);
 *   clearWatch(watchId);
 */

const isCapacitor = () =>
  typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

let _bgGeo = null;

async function loadBackgroundGeolocation() {
  if (_bgGeo) return _bgGeo;
  const { BackgroundGeolocation } = await import(
    /* webpackIgnore: true */ '/node_modules/@capacitor-community/background-geolocation/dist/esm/index.js'
  );
  _bgGeo = BackgroundGeolocation;
  return _bgGeo;
}

/**
 * Start watching position.
 * @returns {Promise<string|number>} watchId to pass to clearWatch()
 */
export async function watchPosition(onSuccess, onError, options = {}) {
  if (!isCapacitor()) {
    return navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000,
      ...options,
    });
  }

  try {
    const BackgroundGeolocation = await loadBackgroundGeolocation();

    const watcherId = await BackgroundGeolocation.addWatcher(
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

    return watcherId;
  } catch (err) {
    console.warn('[GeoAdapter] BackgroundGeolocation failed, using browser API:', err);
    return navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000,
      ...options,
    });
  }
}

/**
 * Stop watching position.
 * @param {string|number} watchId returned by watchPosition()
 */
export async function clearWatch(watchId) {
  if (!isCapacitor() || typeof watchId === 'number') {
    navigator.geolocation.clearWatch(watchId);
    return;
  }

  try {
    const BackgroundGeolocation = await loadBackgroundGeolocation();
    await BackgroundGeolocation.removeWatcher({ id: watchId });
  } catch (err) {
    console.warn('[GeoAdapter] removeWatcher failed:', err);
  }
}

/**
 * Request location permissions upfront (Android only).
 * Call this before starting navigation so the permission dialog
 * appears at a natural moment, not mid-navigation.
 */
export async function requestPermissions() {
  if (!isCapacitor()) return true;

  try {
    const BackgroundGeolocation = await loadBackgroundGeolocation();
    await BackgroundGeolocation.addWatcher(
      { requestPermissions: true, stale: true },
      () => {}
    ).then(id => BackgroundGeolocation.removeWatcher({ id }));
    return true;
  } catch (err) {
    console.warn('[GeoAdapter] requestPermissions failed:', err);
    return false;
  }
}
