import type { Place } from '../data/types';

export type SubmitAdminPlaceResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/**
 * Опциональный бэкенд: POST на VITE_ADMIN_PLACES_API с телом `{ token, place }`.
 * Сервер должен сверить `token` с секретом (на сервере), записать место в БД и вернуть 2xx.
 * Если переменная не задана — вызывающий код сохраняет только локально / в каталог вручную.
 */
export async function submitAdminPlaceToApi(
  apiUrl: string,
  token: string,
  place: Place,
): Promise<SubmitAdminPlaceResult> {
  const url = apiUrl.trim();
  if (!url) return { ok: false, message: 'API URL не задан' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, place }),
    });
    if (res.ok) {
      return { ok: true, message: 'Сервер принял место' };
    }
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      message: text ? `Сервер: ${res.status} — ${text.slice(0, 200)}` : `Сервер: ${res.status}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Сеть: ${msg}` };
  }
}

export function adminPlacesDeleteUrlFromPlacesPostUrl(postPlacesUrl: string): string {
  const u = postPlacesUrl.trim().replace(/\/$/, '');
  return `${u}/delete`;
}

/**
 * Удаление места на сервере: POST `{ token, id }` на …/api/places/delete.
 */
export async function deleteAdminPlaceFromApi(
  postPlacesUrl: string,
  token: string,
  placeId: string,
): Promise<SubmitAdminPlaceResult> {
  if (!postPlacesUrl.trim()) {
    return { ok: false, message: 'API URL не задан' };
  }
  const deleteUrl = adminPlacesDeleteUrlFromPlacesPostUrl(postPlacesUrl);
  try {
    const res = await fetch(deleteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, id: placeId }),
    });
    if (res.ok) {
      return { ok: true, message: 'Удалено' };
    }
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      message: text ? `Сервер: ${res.status} — ${text.slice(0, 200)}` : `Сервер: ${res.status}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Сеть: ${msg}` };
  }
}

export function adminPlacesApiUrlFromEnv(): string {
  const v = import.meta.env.VITE_ADMIN_PLACES_API;
  return typeof v === 'string' ? v.trim() : '';
}
