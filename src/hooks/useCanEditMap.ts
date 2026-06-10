import { useMemo } from 'react';
import { useAdminMode } from './useAdminMode';
import { useCurrentUser } from './useCurrentUser';

/**
 * Витрина (/): редактирование только у админа.
 * Личная карта (/:username): у залогиненного владельца страницы.
 */
export function useCanEditMap(profileUsername?: string): boolean {
  const { user, loading } = useCurrentUser();
  const adminMode = useAdminMode(user?.email);

  return useMemo(() => {
    if (profileUsername) {
      if (loading || !user?.username) return false;
      return user.username.toLowerCase() === profileUsername.toLowerCase();
    }
    return adminMode;
  }, [profileUsername, loading, user?.username, adminMode]);
}
