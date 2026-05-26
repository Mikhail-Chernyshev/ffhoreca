import type { City } from '../data/types';
import { apiBaseUrl } from './apiBase';
import { apiErrorMessage, apiMessage } from './apiMessages';

function parseAdminToken(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') ?? '';
}

export async function postCity(city: City): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };
  const token = parseAdminToken();
  if (!token) return { ok: false, message: apiMessage('api.noAdminToken') };

  const res = await fetch(`${base}/api/cities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, city }),
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.citySaved') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}

export async function deleteCityById(id: string): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };
  const token = parseAdminToken();
  if (!token) return { ok: false, message: apiMessage('api.noAdminToken') };

  const res = await fetch(`${base}/api/cities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': token },
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.cityDeleted') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}
