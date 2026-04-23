import type { Place } from '../data/types';

const STORAGE_KEY = 'ffhoreca_admin_places_v1';

export function loadAdminPlacesFromStorage(): Place[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is Place => p != null && typeof p === 'object' && 'id' in p) as Place[];
  } catch {
    return [];
  }
}

export function saveAdminPlacesToStorage(places: Place[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {
    /* quota / private mode */
  }
}
