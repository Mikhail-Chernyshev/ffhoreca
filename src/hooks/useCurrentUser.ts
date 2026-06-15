import { useState, useEffect, useCallback } from 'react';
import {
  fetchCurrentUser,
  logout as doLogout,
  type AuthUser,
} from '../lib/apiAuth';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => void;
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
    void refetch();
  }, [refetch]);

  const logout = useCallback(() => {
    void doLogout().then(() => setUser(null));
  }, []);

  return { user, loading, refetch, logout };
}
