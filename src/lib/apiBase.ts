/** Базовый URL API (без слэша в конце). Пример: http://localhost:3001 */
export function apiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v !== 'string') return '';
  return v.replace(/\/+$/, '').trim();
}
