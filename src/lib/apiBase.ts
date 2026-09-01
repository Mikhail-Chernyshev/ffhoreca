export function apiBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (typeof url !== 'string') return '';
  return url.replace(/\/+$/, '').trim();
}

export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include',
  });
}

export function mediaUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return apiBaseUrl() + path;
}
