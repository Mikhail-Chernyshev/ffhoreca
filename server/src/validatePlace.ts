import type { Place, PlaceCategory } from '../../src/data/types';
import { FIELD_LIMITS, hasMaxLen, isValidPhotoUrl } from './security';

const CATS: Set<PlaceCategory> = new Set(['lodging', 'food', 'bar', 'airport', 'attraction']);

export function isValidPlace(x: unknown): x is Place {
  if (x == null || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  if (!hasMaxLen(p.id, FIELD_LIMITS.id)) return false;
  if (!hasMaxLen(p.name, FIELD_LIMITS.name)) return false;
  if (typeof p.countryCode !== 'string' || p.countryCode.length !== 2) return false;
  if (!hasMaxLen(p.cityId, FIELD_LIMITS.id)) return false;
  if (!Array.isArray(p.categories) || p.categories.length === 0 || p.categories.length > 5) {
    return false;
  }
  for (const c of p.categories) {
    if (typeof c !== 'string' || !CATS.has(c as PlaceCategory)) return false;
  }
  if (!hasMaxLen(p.address, FIELD_LIMITS.address)) return false;
  if (!hasMaxLen(p.summary, FIELD_LIMITS.summary)) return false;
  if (!hasMaxLen(p.story, FIELD_LIMITS.story)) return false;
  if (p.googleRating != null) {
    if (typeof p.googleRating !== 'number' || p.googleRating < 0 || p.googleRating > 5) {
      return false;
    }
  }
  if (p.photos === null) {
    /* ok — фото нет */
  } else if (Array.isArray(p.photos)) {
    if (p.photos.length === 0 || p.photos.length > FIELD_LIMITS.photosMax) return false;
    for (const ph of p.photos) {
      if (typeof ph !== 'string' || !isValidPhotoUrl(ph)) return false;
    }
  } else {
    return false;
  }
  if (p.lng != null && typeof p.lng !== 'number') return false;
  if (p.lat != null && typeof p.lat !== 'number') return false;
  return true;
}
