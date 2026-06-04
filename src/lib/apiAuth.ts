import { apiBaseUrl } from './apiBase';

export interface AuthUser {
  id: string;
  username: string | null;
  name: string;
  avatar: string | null;
  email: string | null;
}

const TOKEN_KEY = 'ffhoreca_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getLoginUrl(): string {
  return `${apiBaseUrl()}/api/auth/google`;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/me`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401) clearToken();
      return null;
    }
    const data = (await res.json()) as { user: AuthUser };
    return data.user;
  } catch {
    return null;
  }
}

export async function setUsername(username: string): Promise<AuthUser> {
  const res = await fetch(`${apiBaseUrl()}/api/auth/username`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ username }),
  });
  const data = (await res.json()) as { user?: AuthUser; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Ошибка');
  return data.user!;
}

export async function searchUsers(q: string): Promise<AuthUser[]> {
  if (!q.trim() || q.trim().length < 2) return [];
  const res = await fetch(`${apiBaseUrl()}/api/users/search?q=${encodeURIComponent(q.trim())}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { users: AuthUser[] };
  return data.users;
}

export async function fetchUserFavorites(): Promise<AuthUser[]> {
  const res = await fetch(`${apiBaseUrl()}/api/user/favorites`, { headers: authHeaders() });
  if (!res.ok) return [];
  const data = (await res.json()) as { favorites: AuthUser[] };
  return data.favorites;
}

export async function addToFavorites(targetId: string): Promise<void> {
  await fetch(`${apiBaseUrl()}/api/user/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ targetId }),
  });
}

export async function removeFromFavorites(targetId: string): Promise<void> {
  await fetch(`${apiBaseUrl()}/api/user/favorites/${targetId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

export function logout(): void {
  clearToken();
}
