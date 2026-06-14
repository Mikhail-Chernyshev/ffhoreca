import { isEmailAdmin } from '../lib/adminToken';

/** Витрину может редактировать только залогиненный пользователь с VITE_ADMIN_EMAIL. */
export function useAdminMode(userEmail?: string | null): boolean {
  return isEmailAdmin(userEmail);
}
