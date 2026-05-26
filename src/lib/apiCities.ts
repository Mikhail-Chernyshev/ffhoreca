import type { City } from '../data/types';
import { apiBaseUrl } from './apiBase';

function parseAdminToken(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') ?? '';
}

export async function postCity(city: City): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: 'API не настроен' };
  const token = parseAdminToken();
  if (!token) return { ok: false, message: 'Нет токена админа в URL' };

  const res = await fetch(`${base}/api/cities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, city }),
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: 'Город сохранён' };
  return {
    ok: false,
    message: text ? `Сервер: ${res.status} — ${text.slice(0, 200)}` : `Ошибка ${res.status}`,
  };
}

export async function deleteCityById(id: string): Promise<{ ok: boolean; message: string }> {
  const base = apiBaseUrl();
  if (!base) return { ok: false, message: 'API не настроен' };
  const token = parseAdminToken();
  if (!token) return { ok: false, message: 'Нет токена админа в URL' };

  const res = await fetch(`${base}/api/cities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': token },
  });
  const text = await res.text().catch(() => '');
  if (res.ok) return { ok: true, message: 'Город удалён' };
  return {
    ok: false,
    message: text ? `Сервер: ${res.status} — ${text.slice(0, 200)}` : `Ошибка ${res.status}`,
  };
}
