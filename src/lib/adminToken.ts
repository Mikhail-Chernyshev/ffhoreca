/**
 * Достаёт секрет из URL: `?token=…`, `#token=…` или фрагмент пути вида `/token=…`.
 * Токен в URL виден в истории и Referer — для продакшена лучше одноразовые ссылки или вход с сервера.
 */
export function parseAdminTokenFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const { search, hash, pathname } = window.location;
  const fromQuery = new URLSearchParams(search).get('token');
  if (fromQuery) return fromQuery.trim();
  const combined = `${pathname}${search}${hash}`;
  const m = combined.match(/(?:^|[/?#])token=([^&\s#]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]).trim();
    } catch {
      return m[1].trim();
    }
  }
  return null;
}

export function adminTokenFromEnv(): string {
  const v = import.meta.env.VITE_ADMIN_TOKEN;
  return typeof v === 'string' ? v.trim() : '';
}

export function adminEmailFromEnv(): string {
  const v = import.meta.env.VITE_ADMIN_EMAIL;
  return typeof v === 'string' ? v.trim() : '';
}

export function isAdminUrlTokenValid(urlToken: string | null): boolean {
  const secret = adminTokenFromEnv();
  if (!secret || urlToken == null || urlToken === '') return false;
  return urlToken === secret;
}

export function isEmailAdmin(email: string | null | undefined): boolean {
  const adminEmail = adminEmailFromEnv();
  return !!adminEmail && !!email && email.toLowerCase() === adminEmail.toLowerCase();
}

/**
 * Возвращает заголовки авторизации для admin-запросов.
 * Если есть JWT (пользователь залогинен) — используем его.
 * Иначе — URL-токен в теле запроса (старый способ).
 */
export function adminAuthHeaders(): Record<string, string> {
  const jwt = localStorage.getItem('ffhoreca_auth_token');
  if (jwt) return { Authorization: `Bearer ${jwt}` };
  return {};
}

/**
 * Токен для тела запроса (старый способ через ?token=).
 * Если есть JWT — возвращаем пустую строку (сервер проверит Authorization header).
 */
export function adminTokenForBody(): string {
  const jwt = localStorage.getItem('ffhoreca_auth_token');
  if (jwt) return '';
  return parseAdminTokenFromLocation() ?? '';
}
