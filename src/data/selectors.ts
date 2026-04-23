import { numericToAlpha2 } from 'i18n-iso-countries';
import type {
  Catalog,
  CategoryFilter,
  City,
  Place,
  PlaceCategory,
} from './types';

const GEO_ID_PAD = 3;

export function geoIdToAlpha2(
  id: string | number | undefined,
): string | undefined {
  if (id == null) return undefined;
  const raw = String(id);
  const padded = raw.padStart(GEO_ID_PAD, '0');
  return numericToAlpha2(padded) ?? numericToAlpha2(raw);
}

/**
 * world-atlas/countries-10m: у каждой страны есть numeric `id` → alpha-2.
 * На всякий случай — запасной путь по англ. `properties.name` (если id не дошёл до path).
 */
const ATLAS_NAME_TO_ALPHA2: Readonly<Record<string, string>> = {
  Germany: 'DE',
  Georgia: 'GE',
  Italy: 'IT',
  Japan: 'JP',
};

export function atlasCountryAlpha2(g: {
  id?: string | number;
  properties?: { name?: string };
}): string | undefined {
  const fromId = geoIdToAlpha2(g.id);
  if (fromId) return fromId;
  const n = g.properties?.name;
  return n != null ? ATLAS_NAME_TO_ALPHA2[n] : undefined;
}

export function visitedCountryCodes(catalog: Catalog): Set<string> {
  const s = new Set<string>();
  for (const c of catalog.cities) s.add(c.countryCode);
  for (const p of catalog.places) s.add(p.countryCode);
  return s;
}

export function cityById(catalog: Catalog, id: string): City | undefined {
  return catalog.cities.find((c) => c.id === id);
}

/** Стабильный сдвиг координат, чтобы несколько точек в одном городе не лежали друг на друге */
export function jitterForId(
  id: string,
  lng: number,
  lat: number,
): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i);
  const dx = ((h % 200) - 100) / 2500;
  const dy = (((h / 200) | 0) % 200) - 100;
  const dlat = dy / 2500;
  return [lng + dx, lat + dlat];
}

export function placeCoordinates(
  catalog: Catalog,
  place: Place,
): [number, number] {
  const city = cityById(catalog, place.cityId);
  const baseLng = place.lng ?? city?.lng ?? 0;
  const baseLat = place.lat ?? city?.lat ?? 0;
  if (place.lng != null && place.lat != null) {
    return [place.lng, place.lat];
  }
  return jitterForId(place.id, baseLng, baseLat);
}

function placeMatchesFilter(place: Place, filter: CategoryFilter): boolean {
  if (filter === 'cities') return false;
  if (filter === 'all' || filter === 'places') return true;
  return place.categories.includes(filter as PlaceCategory);
}

export function placesForFilter(
  catalog: Catalog,
  filter: CategoryFilter,
): Place[] {
  return catalog.places.filter((p) => placeMatchesFilter(p, filter));
}

/** Места из админ-формы (localStorage) склеиваются после записей из `catalog.ts`. */
export function mergeCatalogWithAdminPlaces(
  base: Catalog,
  adminPlaces: Place[],
): Catalog {
  if (adminPlaces.length === 0) return base;
  return { ...base, places: [...base.places, ...adminPlaces] };
}

export function markerColorClass(place: Place): string {
  const order: PlaceCategory[] = ['lodging', 'food', 'bar', 'airport'];
  for (const c of order) {
    if (place.categories.includes(c)) {
      return `place-dot--${c}`;
    }
  }
  return 'place-dot--food';
}
