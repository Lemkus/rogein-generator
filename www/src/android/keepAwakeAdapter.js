/**
 * Keep-Awake Adapter
 *
 * In Android (Capacitor): uses KeepAwake plugin via the native Capacitor bridge
 * (window.Capacitor.Plugins) — sets FLAG_KEEP_SCREEN_ON so the screen stays on.
 *
 * In browser: uses Screen Wake Lock API with video fallback.
 *
 * Usage:
 *   import { activateWakeLock, releaseWakeLock } from './android/keepAwakeAdapter.js';
 *   await activateWakeLock();
 *   await releaseWakeLock();
 */

const isCapacitorNative = () =>
  typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

/**
 * Returns the KeepAwake plugin from the Capacitor bridge.
 * Available automatically when running inside the Capacitor WebView.
 */
function getKeepAwake() {
  return window.Capacitor?.Plugins?.KeepAwake ?? null;
}

let _browserWakeLock = null;
let _videoFallbackTimer = null;
let _active = false;

export async function activateWakeLock() {
  if (_active) return;

  const keepAwake = isCapacitorNative() ? getKeepAwake() : null;

  if (keepAwake) {
    try {
      await keepAwake.keepAwake();
      _active = true;
      console.log('[WakeLock] Capacitor KeepAwake активирован');
      return;
    } catch (err) {
      console.warn('[WakeLock] KeepAwake plugin failed:', err);
    }
  }

  // Browser: Screen Wake Lock API
  if ('wakeLock' in navigator) {
    try {
      _browserWakeLock = await navigator.wakeLock.request('screen');
      _active = true;
      console.log('[WakeLock] Screen Wake Lock API активирован');

      _browserWakeLock.addEventListener('release', () => {
        _active = false;
      });

      document.addEventListener('visibilitychange', _onVisibilityChange);
      return;
    } catch (err) {
      console.warn('[WakeLock] Wake Lock API недоступен:', err);
    }
  }

  // Last-resort: muted video loop
  _startVideoFallback();
  _active = true;
}

export async function releaseWakeLock() {
  if (!_active) return;

  const keepAwake = isCapacitorNative() ? getKeepAwake() : null;

  if (keepAwake) {
    try {
      await keepAwake.allowSleep();
    } catch (err) {
      console.warn('[WakeLock] allowSleep failed:', err);
    }
  }

  if (_browserWakeLock) {
    try { await _browserWakeLock.release(); } catch (_) {}
    _browserWakeLock = null;
    document.removeEventListener('visibilitychange', _onVisibilityChange);
  }

  _stopVideoFallback();
  _active = false;
  console.log('[WakeLock] деактивирован');
}

async function _onVisibilityChange() {
  if (document.visibilityState === 'visible' && !_browserWakeLock) {
    try {
      _browserWakeLock = await navigator.wakeLock.request('screen');
      _active = true;
    } catch (_) {}
  }
}

function _startVideoFallback() {
  const video = document.createElement('video');
  video.setAttribute('loop', '');
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:-9999px';
  video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28ybXA0MWAA';
  document.body.appendChild(video);
  video.play().catch(() => {});
  window.__wakeLockVideo = video;
  _videoFallbackTimer = setInterval(() => {
    if (video.paused) video.play().catch(() => {});
  }, 10000);
}

function _stopVideoFallback() {
  if (_videoFallbackTimer) {
    clearInterval(_videoFallbackTimer);
    _videoFallbackTimer = null;
  }
  if (window.__wakeLockVideo) {
    window.__wakeLockVideo.pause();
    window.__wakeLockVideo.remove();
    delete window.__wakeLockVideo;
  }
}
