/** Базовый URL API (без слэша в конце). Пример: http://localhost:3001 */
export function apiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v !== 'string') return '';
  return v.replace(/\/+$/, '').trim();
}

/**
 * Превращает путь вида `/uploads/abc.jpg` в полный URL бэкенда.
 * Если путь уже абсолютный (http/https) — возвращает как есть.
 */
export function mediaUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return apiBaseUrl() + path;
}
