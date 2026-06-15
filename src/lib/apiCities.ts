import type { City } from '../data/types';
import { apiBaseUrl, apiFetch } from './apiBase';
import { apiErrorMessage, apiMessage } from './apiMessages';

export async function postCity(city: City): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };

  const res = await apiFetch(`${base}/api/cities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city }),
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.citySaved') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}

export async function deleteCityById(id: string): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: apiMessage('api.notConfigured') };

  const res = await apiFetch(`${base}/api/cities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: apiMessage('api.cityDeleted') };
  return { ok: false, message: apiErrorMessage(res.status, text) };
}
