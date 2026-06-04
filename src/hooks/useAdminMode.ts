import { useEffect, useMemo, useState } from 'react';
import {
  adminTokenFromEnv,
  isAdminUrlTokenValid,
  isEmailAdmin,
  parseAdminTokenFromLocation,
} from '../lib/adminToken';

/**
 * Возвращает true если:
 * - в URL есть валидный token=…, совпадающий с VITE_ADMIN_TOKEN, ИЛИ
 * - залогиненный пользователь имеет email = VITE_ADMIN_EMAIL
 */
export function useAdminMode(userEmail?: string | null): boolean {
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
    const urlTokenAdmin = isAdminUrlTokenValid(parseAdminTokenFromLocation());
    const emailAdmin = isEmailAdmin(userEmail);
    return urlTokenAdmin || emailAdmin;
  }, [rev, userEmail]);
}
