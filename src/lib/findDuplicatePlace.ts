import type { Place } from '../data/types';

function normalizePlaceName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(sin)));
}

const CLOSE_METERS = 50;

/** Уже существующее место с тем же названием в городе или той же точкой на карте. */
export function findDuplicatePlace(
  existing: readonly Place[],
  draft: Pick<Place, 'name' | 'cityId' | 'lat' | 'lng'>,
): Place | null {
  const nameNorm = normalizePlaceName(draft.name);
  if (!nameNorm) return null;

  const draftHasCoords = draft.lat != null && draft.lng != null;

  for (const place of existing) {
    const sameCity = place.cityId === draft.cityId;
    const sameName = normalizePlaceName(place.name) === nameNorm;
    if (sameCity && sameName) return place;

    if (
      draftHasCoords &&
      place.lat != null &&
      place.lng != null &&
      sameName &&
      metersBetween(
        { lat: place.lat, lng: place.lng },
        { lat: draft.lat!, lng: draft.lng! },
      ) < CLOSE_METERS
    ) {
      return place;
    }
  }
  return null;
}
