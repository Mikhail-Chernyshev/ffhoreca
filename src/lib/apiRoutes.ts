import type { TravelRoute } from '../data/types';
import { apiBaseUrl, apiFetch } from './apiBase';
import { apiErrorMessage, apiMessage } from './apiMessages';

export async function fetchRoutes(): Promise<TravelRoute[]> {
  const base = apiBaseUrl();
  if (!base) return [];
  const res = await apiFetch(`${base}/api/routes`);
  if (!res.ok) return [];
  return res.json() as Promise<TravelRoute[]>;
}

export async function postRoute(route: TravelRoute): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };

  const res = await apiFetch(`${base}/api/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ route }),
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.routeSaved') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}

export async function deleteRouteById(id: string): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };

  const res = await apiFetch(`${base}/api/routes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.routeDeleted') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}
