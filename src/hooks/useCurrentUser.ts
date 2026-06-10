import { useState, useEffect, useCallback } from 'react';
import {
  fetchCurrentUser,
  storeToken,
  clearToken,
  logout as doLogout,
  type AuthUser,
} from '../lib/apiAuth';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => void;
}

/** Reads ?auth_token= from URL, saves to localStorage, clears param. */
function consumeTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token');
  if (token) {
    storeToken(token);
    params.delete('auth_token');
    const newUrl =
      window.location.pathname +
      (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState(null, '', newUrl);
    return token;
  }
  return null;
}

export function useCurrentUser(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const u = await fetchCurrentUser();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    consumeTokenFromUrl();
    void refetch();
  }, [refetch]);

  const logout = useCallback(() => {
    doLogout();
    clearToken();
    setUser(null);
  }, []);

  return { user, loading, refetch, logout };
}
