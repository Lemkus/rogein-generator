/**
 * Keep-Awake Adapter
 *
 * Prevents screen from sleeping and keeps the CPU running during navigation.
 * - In Android: uses @capacitor-community/keep-awake (FLAG_KEEP_SCREEN_ON).
 * - In browser: uses Screen Wake Lock API + hidden video fallback.
 *
 * Usage:
 *   import { activateWakeLock, releaseWakeLock } from './android/keepAwakeAdapter.js';
 *
 *   await activateWakeLock();
 *   await releaseWakeLock();
 */

const isCapacitor = () =>
  typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();

let _keepAwake = null;
let _browserWakeLock = null;
let _videoFallbackTimer = null;
let _active = false;

async function loadKeepAwake() {
  if (_keepAwake) return _keepAwake;
  const { KeepAwake } = await import(
    /* webpackIgnore: true */ '/node_modules/@capacitor-community/keep-awake/dist/esm/index.js'
  );
  _keepAwake = KeepAwake;
  return _keepAwake;
}

export async function activateWakeLock() {
  if (_active) return;

  if (isCapacitor()) {
    try {
      const KeepAwake = await loadKeepAwake();
      await KeepAwake.keepAwake();
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
        console.log('[WakeLock] Wake Lock освобождён браузером');
      });

      document.addEventListener('visibilitychange', _onVisibilityChange);
      return;
    } catch (err) {
      console.warn('[WakeLock] Wake Lock API недоступен:', err);
    }
  }

  // Last-resort fallback: muted video loop (old browser trick)
  _startVideoFallback();
  _active = true;
}

export async function releaseWakeLock() {
  if (!_active) return;

  if (isCapacitor()) {
    try {
      const KeepAwake = await loadKeepAwake();
      await KeepAwake.allowSleep();
    } catch (err) {
      console.warn('[WakeLock] allowSleep failed:', err);
    }
  }

  if (_browserWakeLock) {
    try {
      await _browserWakeLock.release();
    } catch (_) {}
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
      console.log('[WakeLock] переактивирован после foreground');
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
