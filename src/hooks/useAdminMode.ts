import { useEffect, useMemo, useState } from 'react';
import {
  adminTokenFromEnv,
  isAdminUrlTokenValid,
  parseAdminTokenFromLocation,
} from '../lib/adminToken';

/**
 * Режим «добавить место»: в URL есть валидный token=…, совпадающий с VITE_ADMIN_TOKEN при сборке.
 */
export function useAdminMode(): boolean {
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const bump = () => setRev((n) => n + 1);
    window.addEventListener('hashchange', bump);
    window.addEventListener('popstate', bump);
    return () => {
      window.removeEventListener('hashchange', bump);
      window.removeEventListener('popstate', bump);
    };
  }, []);

  return useMemo(() => {
    void rev;
    void adminTokenFromEnv();
    return isAdminUrlTokenValid(parseAdminTokenFromLocation());
  }, [rev]);
}
