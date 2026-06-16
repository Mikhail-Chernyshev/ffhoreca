import { apiBaseUrl } from './apiBase';

/** Прямая ссылка на карту на фронте (GitHub Pages). */
export function mapPageUrl(username: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '') || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${base}/${encodeURIComponent(username)}`;
}

/**
 * Ссылка для превью в мессенджерах (OG-теги отдаёт API).
 * Редиректит человека на mapPageUrl.
 */
export function mapShareUrl(username: string): string {
  const api = apiBaseUrl();
  if (!api) return mapPageUrl(username);
  return `${api}/share/${encodeURIComponent(username)}`;
}
