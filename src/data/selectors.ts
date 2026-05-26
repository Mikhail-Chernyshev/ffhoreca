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

/**
 * Страны, где были только транзитом / пересадкой — на карте отдельный (жёлтый) тон заливки.
 */
export const TRANSIT_LAYOVER_COUNTRY_CODES: ReadonlySet<string> = new Set([
  'AZ',
  'QA',
]);

export function cityById(catalog: Catalog, id: string): City | undefined {
  return catalog.cities.find((c) => c.id === id);
}

function normalizeCityToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е');
}

const PHOTON_NEAREST_MAX_KM = 35;

/**
 * Подобрать id города из каталога по данным Photon (названия + координаты).
 * Если уверенного совпадения нет — возвращает undefined (оставить текущий выбор в форме).
 */
export function catalogCityIdFromPhotonHints(
  catalog: Catalog,
  lat: number,
  lng: number,
  localityHints: readonly string[],
  countryCodeOsm: string | undefined,
): string | undefined {
  if (catalog.cities.length === 0) return undefined;

  const cc = countryCodeOsm?.toUpperCase();
  const hints = localityHints.map(normalizeCityToken).filter(Boolean);

  const inCountry = cc
    ? catalog.cities.filter((c) => c.countryCode.toUpperCase() === cc)
    : catalog.cities;

  const tryExact = (pool: City[]) => {
    for (const h of hints) {
      for (const city of pool) {
        if (normalizeCityToken(city.name) === h) return city.id;
      }
    }
    return undefined;
  };

  const exactInCountry = tryExact(inCountry.length > 0 ? inCountry : catalog.cities);
  if (exactInCountry) return exactInCountry;

  if (cc && inCountry.length > 0) {
    const exactAny = tryExact(catalog.cities);
    if (exactAny) return exactAny;
  }

  const tryPartial = (pool: City[]) => {
    for (const h of hints) {
      for (const city of pool) {
        const cn = normalizeCityToken(city.name);
        if (h.includes(cn) || cn.includes(h)) return city.id;
      }
    }
    return undefined;
  };

  const partial = tryPartial(inCountry.length > 0 ? inCountry : catalog.cities);
  if (partial) return partial;

  const pool = inCountry.length > 0 ? inCountry : catalog.cities;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const havKm = (la1: number, lo1: number, la2: number, lo2: number) => {
    const dLat = toRad(la2 - la1);
    const dLon = toRad(lo2 - lo1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  };

  let best: { id: string; d: number } | null = null;
  for (const city of pool) {
    const d = havKm(lat, lng, city.lat, city.lng);
    if (!best || d < best.d) best = { id: city.id, d };
  }
  if (best && best.d <= PHOTON_NEAREST_MAX_KM) return best.id;

  return undefined;
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
  if (filter === 'all') return true;
  if (filter === 'places') return place.categories.includes('attraction');
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
  const adminById = new Map(adminPlaces.map((p) => [p.id, p]));
  const mergedFromBase = base.places.map((p) => adminById.get(p.id) ?? p);
  const baseIds = new Set(base.places.map((p) => p.id));
  const newOnly = adminPlaces.filter((p) => !baseIds.has(p.id));
  return { ...base, places: [...mergedFromBase, ...newOnly] };
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
