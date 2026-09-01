import { apiBaseUrl, apiFetch } from './apiBase';
import type { MapVisibility, UserSubscription } from '../data/subscription';

export interface UserUsage {
  countries: number;
  cities: number;
  routes: number;
  places: number;
}

export interface AuthUser {
  id: string;
  username: string | null;
  name: string;
  avatar: string | null;
  email: string | null;
  subscription: UserSubscription;
  map_visibility: MapVisibility;
}

export interface AuthAccount {
  user: AuthUser;
  usage: UserUsage;
}

const SESSION_TOKEN_KEY = 'ffhoreca_session_token';
const LEGACY_TOKEN_KEY = 'ffhoreca_auth_token';

/** sessionStorage: работает при фронте на GitHub Pages и API на Fly (cookie third-party блокируется). */
export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export function storeSessionToken(token: string): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getLoginUrl(): string {
  return `${apiBaseUrl()}/api/auth/google`;
}

function parseAuthUser(u: Partial<AuthUser>): AuthUser {
  return {
    id: u.id!,
    username: u.username ?? null,
    name: u.name!,
    avatar: u.avatar ?? null,
    email: u.email ?? null,
    subscription: u.subscription === 'premium' ? 'premium' : 'freemium',
    map_visibility:
      u.map_visibility === 'subscribers' ? 'subscribers' : 'public',
  };
}

/** Старый API мог не отдавать usage.cities — тогда считаем по каталогу пользователя. */
async function resolveCitiesUsage(
  usage: Partial<UserUsage> | undefined,
  username: string | null,
): Promise<number> {
  if (typeof usage?.cities === 'number' && Number.isFinite(usage.cities)) {
    return Math.max(0, Math.floor(usage.cities));
  }
  if (!username) return 0;
  const base = apiBaseUrl();
  if (!base) return 0;
  try {
    const res = await apiFetch(
      `${base}/api/users/${encodeURIComponent(username)}/catalog`,
      {
        headers: authHeaders(),
      },
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as { cities?: unknown };
    return Array.isArray(data.cities) ? data.cities.length : 0;
  } catch {
    return 0;
  }
}

async function parseUsage(
  usage: Partial<UserUsage> | undefined,
  username: string | null,
): Promise<UserUsage> {
  return {
    countries: usage?.countries ?? 0,
    cities: await resolveCitiesUsage(usage, username),
    routes: usage?.routes ?? 0,
    places: usage?.places ?? 0,
  };
}

export async function exchangeAuthCode(code: string): Promise<boolean> {
  const base = apiBaseUrl();
  if (!base) return false;
  try {
    const res = await apiFetch(`${base}/api/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { token?: string };
    if (!data.token) return false;
    storeSessionToken(data.token);
    return true;
  } catch {
    return false;
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const base = apiBaseUrl();
  if (!base) return null;
  try {
    const res = await apiFetch(`${base}/api/auth/me`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      if (res.status === 401) clearSessionToken();
      return null;
    }
    const data = (await res.json()) as { user: Partial<AuthUser> };
    return parseAuthUser(data.user);
  } catch {
    return null;
  }
}

export async function fetchAuthAccount(): Promise<AuthAccount | null> {
  const base = apiBaseUrl();
  if (!base) return null;
  try {
    const res = await apiFetch(`${base}/api/auth/me`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      if (res.status === 401) clearSessionToken();
      return null;
    }
    const data = (await res.json()) as {
      user: Partial<AuthUser>;
      usage?: Partial<UserUsage>;
    };
    const user = parseAuthUser(data.user);
    return {
      user,
      usage: await parseUsage(data.usage, user.username),
    };
  } catch {
    return null;
  }
}

export async function updateAccountSettings(
  map_visibility: MapVisibility,
): Promise<AuthAccount> {
  const res = await apiFetch(`${apiBaseUrl()}/api/auth/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ map_visibility }),
  });
  const data = (await res.json()) as {
    user?: Partial<AuthUser>;
    usage?: Partial<UserUsage>;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? 'Ошибка');
  const user = parseAuthUser(data.user!);
  return {
    user,
    usage: await parseUsage(data.usage, user.username),
  };
}

export async function setUsername(username: string): Promise<AuthUser> {
  const res = await apiFetch(`${apiBaseUrl()}/api/auth/username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ username }),
  });
  const data = (await res.json()) as { user?: AuthUser; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Ошибка');
  return parseAuthUser(data.user!);
}

export async function searchUsers(q: string): Promise<AuthUser[]> {
  if (!q.trim() || q.trim().length < 2) return [];
  const res = await apiFetch(
    `${apiBaseUrl()}/api/users/search?q=${encodeURIComponent(q.trim())}`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { users: AuthUser[] };
  return data.users;
}

export interface AdminUserListItem extends AuthUser {
  created_at?: number;
}

export async function fetchAdminUsers(): Promise<AdminUserListItem[]> {
  const base = apiBaseUrl();
  if (!base) throw new Error('API не настроен');
  const res = await apiFetch(`${base}/api/admin/users`, {
    headers: authHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    users?: AdminUserListItem[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return (data.users ?? []).map((u) => ({
    ...parseAuthUser(u),
    created_at: u.created_at,
  }));
}

export async function fetchUserFavorites(): Promise<AuthUser[]> {
  const res = await apiFetch(`${apiBaseUrl()}/api/user/favorites`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { favorites: AuthUser[] };
  return data.favorites;
}

export async function addToFavorites(targetId: string): Promise<void> {
  const res = await apiFetch(`${apiBaseUrl()}/api/user/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ targetId }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

export async function removeFromFavorites(targetId: string): Promise<void> {
  const res = await apiFetch(`${apiBaseUrl()}/api/user/favorites/${targetId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

export async function logout(): Promise<void> {
  clearSessionToken();
  const base = apiBaseUrl();
  if (!base) return;
  try {
    await apiFetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: authHeaders(),
    });
  } catch {
    /* ignore */
  }
}

export async function deleteAccount(): Promise<void> {
  const base = apiBaseUrl();
  if (!base) throw new Error('Не авторизован');
  const res = await apiFetch(`${base}/api/user/account`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Не удалось удалить аккаунт');
  clearSessionToken();
}
