import { useState, useEffect, useCallback } from 'react';
import {
  fetchCurrentUser,
  exchangeAuthCode,
  logout as doLogout,
  clearLegacyToken,
  type AuthUser,
} from '../lib/apiAuth';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => void;
}

function stripAuthParamsFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const authCode = params.get('auth_code');
  const hadLegacy =
    params.has('auth_token')
    || params.has('auth_ok')
    || params.has('auth_error')
    || Boolean(authCode);
  if (!hadLegacy) return null;

  params.delete('auth_token');
  params.delete('auth_ok');
  params.delete('auth_code');
  return params.toString();
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
    let cancelled = false;

    const init = async () => {
      clearLegacyToken();

      const params = new URLSearchParams(window.location.search);
      const authCode = params.get('auth_code')?.trim();
      if (authCode) {
        await exchangeAuthCode(authCode);
      }

      const restQuery = stripAuthParamsFromUrl();
      if (restQuery !== null) {
        const newUrl =
          window.location.pathname + (restQuery ? `?${restQuery}` : '');
        window.history.replaceState(null, '', newUrl);
      }

      if (!cancelled) await refetch();
    };

    void init();
    return () => { cancelled = true; };
  }, [refetch]);

  const logout = useCallback(() => {
    void doLogout().then(() => setUser(null));
  }, []);

  return { user, loading, refetch, logout };
}
