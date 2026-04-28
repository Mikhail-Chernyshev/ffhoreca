const STORAGE_KEY = 'ffhoreca_admin_deleted_place_ids_v1';

/** ID мест, скрытых при офлайн-режиме (удаление из встроенного каталога и правки). */
export function loadDeletedPlaceIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function saveDeletedPlaceIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* quota */
  }
}
