import type { TravelRoute } from '../data/types';
import { apiBaseUrl } from './apiBase';
import { apiErrorMessage, apiMessage } from './apiMessages';

function parseAdminToken(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') ?? '';
}

export async function fetchRoutes(): Promise<TravelRoute[]> {
  const base = apiBaseUrl();
  if (!base) return [];
  const res = await fetch(`${base}/api/routes`);
  if (!res.ok) return [];
  return res.json() as Promise<TravelRoute[]>;
}

export async function postRoute(route: TravelRoute): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };
  const token = parseAdminToken();
  const res = await fetch(`${base}/api/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, route }),
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.routeSaved') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}

export async function deleteRouteById(id: string): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };
  const token = parseAdminToken();
  const res = await fetch(`${base}/api/routes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': token },
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.routeDeleted') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}
