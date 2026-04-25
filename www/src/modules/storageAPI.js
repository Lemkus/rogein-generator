import { BACKEND_SIMPLE_BASE } from './config.js';

export async function saveRoute(payload) {
  const res = await fetch(`${BACKEND_SIMPLE_BASE}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      description: payload.description,
      points: payload.points,
      startPoint: payload.startPoint,
      bounds: payload.bounds
    })
  });
  if (!res.ok) throw new Error('Failed to save route');
  return await res.json();
}

export async function getRoutesList() {
  const res = await fetch(`${BACKEND_SIMPLE_BASE}/routes`);
  if (!res.ok) throw new Error('Failed to fetch routes');
  return await res.json();
}

export async function getRouteById(id) {
  const res = await fetch(`${BACKEND_SIMPLE_BASE}/routes/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch route');
  return await res.json();
}

export function buildShareUrl(routeId) {
  const url = new URL(window.location.href);
  url.searchParams.set('routeId', routeId);
  return url.toString();
}
