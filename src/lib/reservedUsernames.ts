/** Имена, занятые маршрутами приложения — нельзя брать как username. */
export const RESERVED_USERNAMES = new Set([
  'privacy',
  'terms',
  'api',
  'share',
  'login',
  'logout',
  'admin',
  'uploads',
  'og-share.png',
  'favicon.svg',
  'favorites',
  'account',
  'settings',
]);

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.trim().toLowerCase());
}
