import type { Place, PlaceCategory } from '../../src/data/types';

const CATS: Set<PlaceCategory> = new Set(['lodging', 'food', 'bar', 'airport']);

export function isValidPlace(x: unknown): x is Place {
  if (x == null || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id.trim()) return false;
  if (typeof p.name !== 'string' || !p.name.trim()) return false;
  if (typeof p.countryCode !== 'string' || p.countryCode.length !== 2) return false;
  if (typeof p.cityId !== 'string' || !p.cityId.trim()) return false;
  if (!Array.isArray(p.categories) || p.categories.length === 0) return false;
  for (const c of p.categories) {
    if (typeof c !== 'string' || !CATS.has(c as PlaceCategory)) return false;
  }
  if (typeof p.address !== 'string' || !p.address.trim()) return false;
  if (typeof p.summary !== 'string' || !p.summary.trim()) return false;
  if (typeof p.story !== 'string' || !p.story.trim()) return false;
  if (p.googleRating != null) {
    if (typeof p.googleRating !== 'number' || p.googleRating < 0 || p.googleRating > 5)
      return false;
  }
  if (!Array.isArray(p.photos) || p.photos.length === 0) return false;
  for (const ph of p.photos) {
    if (typeof ph !== 'string' || !ph.trim()) return false;
  }
  if (p.lng != null && typeof p.lng !== 'number') return false;
  if (p.lat != null && typeof p.lat !== 'number') return false;
  return true;
}
