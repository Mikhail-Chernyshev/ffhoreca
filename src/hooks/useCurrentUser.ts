import { useState, useEffect, useCallback } from 'react';
import {
  fetchCurrentUser,
  clearLegacyToken,
  logout as doLogout,
  type AuthUser,
} from '../lib/apiAuth';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => void;
}

/** Убирает auth-параметры из URL после OAuth-редиректа (токен теперь в HttpOnly cookie). */
function consumeAuthParamsFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('auth_token') && !params.has('auth_ok') && !params.has('auth_error')) {
    return;
  }
  params.delete('auth_token');
  params.delete('auth_ok');
  clearLegacyToken();
  const newUrl =
    window.location.pathname +
    (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState(null, '', newUrl);
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
    clearLegacyToken();
    consumeAuthParamsFromUrl();
    void refetch();
  }, [refetch]);

  const logout = useCallback(() => {
    void doLogout().then(() => setUser(null));
  }, []);

  return { user, loading, refetch, logout };
}
