/**
 * API-функции для редактирования СОБСТВЕННОЙ карты пользователя.
 * Все запросы используют Authorization: Bearer <jwt> вместо ADMIN_TOKEN.
 */
import type { City, Place, TravelRoute } from '../data/types';
import { apiBaseUrl } from './apiBase';
import { authHeaders } from './apiAuth';

async function userPost(path: string, body: unknown): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: 'API не настроен' };
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    if (res.ok) return { ok: true, message: '' };
    let msg = '';
    try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { msg = text; }
    return { ok: false, message: msg || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function userDelete(path: string): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: 'API не настроен' };
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const text = await res.text().catch(() => '');
    if (res.ok) return { ok: true, message: '' };
    let msg = '';
    try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { msg = text; }
    return { ok: false, message: msg || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function userPostCity(city: City): Promise<{ ok: boolean; message: string }> {
  return userPost('/api/user/cities', { city });
}

export async function userDeleteCity(id: string): Promise<{ ok: boolean; message: string }> {
  return userDelete(`/api/user/cities/${encodeURIComponent(id)}`);
}

export async function userPostPlace(
  place: Place,
  city?: City,
): Promise<{ ok: boolean; message: string }> {
  return userPost('/api/user/places', { place, city });
}

export async function userDeletePlace(id: string): Promise<{ ok: boolean; message: string }> {
  return userPost('/api/user/places/delete', { id });
}

export async function userPostRoute(route: TravelRoute): Promise<{ ok: boolean; message: string }> {
  return userPost('/api/user/routes', { route });
}

export async function userDeleteRoute(id: string): Promise<{ ok: boolean; message: string }> {
  return userDelete(`/api/user/routes/${encodeURIComponent(id)}`);
}

/** Загружает фото на сервер, возвращает массив URL. */
export async function userUploadPhotos(files: File[]): Promise<string[]> {
  const base = apiBaseUrl();
  if (!base || files.length === 0) return [];
  const fd = new FormData();
  for (const f of files) fd.append('photos', f);
  const res = await fetch(`${base}/api/user/photos`, {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  if (!res.ok) throw new Error(`Фото: HTTP ${res.status}`);
  const json = (await res.json()) as { urls: string[] };
  return json.urls;
}
