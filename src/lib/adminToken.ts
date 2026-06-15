export function adminEmailFromEnv(): string {
  const v = import.meta.env.VITE_ADMIN_EMAIL;
  return typeof v === 'string' ? v.trim() : '';
}

export function isEmailAdmin(email: string | null | undefined): boolean {
  const adminEmail = adminEmailFromEnv();
  return !!adminEmail && !!email && email.toLowerCase() === adminEmail.toLowerCase();
}

/** Сессия в HttpOnly cookie — отдельный Authorization не нужен. */
export function adminAuthHeaders(): Record<string, string> {
  return {};
}
