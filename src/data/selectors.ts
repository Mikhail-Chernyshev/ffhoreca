import { numericToAlpha2 } from 'i18n-iso-countries';
import { isFineGrainedLocality } from '../lib/photonAddressSearch';
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

/** Подрайон (khwaeng и т.п.) — не город для заливки и метки на табах категорий */
export function isFineGrainedCity(city: City): boolean {
  if (isFineGrainedLocality(city.name)) return true;
  return city.id.toLowerCase().includes('khwaeng');
}

/** Место в подрайоне привязываем к ближайшему «настоящему» городу той же страны */
function parentCityForPlaceCity(
  catalog: Catalog,
  placeCityId: string,
  coords?: { lat: number; lng: number },
): City | undefined {
  const city = cityById(catalog, placeCityId);
  if (!city) return undefined;
  if (!isFineGrainedCity(city)) return city;

  const cc = city.countryCode.toUpperCase();
  const lat = coords?.lat ?? city.lat;
  const lng = coords?.lng ?? city.lng;
  let best: City | undefined;
  let bestDist = Infinity;
  for (const c of catalog.cities) {
    if (isFineGrainedCity(c) || c.countryCode.toUpperCase() !== cc) continue;
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best && bestDist <= PARENT_CITY_MAX_KM ? best : undefined;
}

/** Город каталога для места: подрайон → ближайший «настоящий» город */
export function canonicalCity(
  catalog: Catalog,
  cityId: string,
  coords?: { lat: number; lng: number },
): City | undefined {
  return parentCityForPlaceCity(catalog, cityId, coords) ?? cityById(catalog, cityId);
}

export function canonicalCityId(
  catalog: Catalog,
  cityId: string,
  coords?: { lat: number; lng: number },
): string {
  return canonicalCity(catalog, cityId, coords)?.id ?? cityId;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLng = (bLng - aLng) * r;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const PARENT_CITY_MAX_KM = 80;

/** Сколько мест привязано к городу (включая записи через подрайоны) */
export function placesCountForCity(catalog: Catalog, cityId: string): number {
  return catalog.places.filter((p) => {
    const coords =
      p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : undefined;
    return canonicalCityId(catalog, p.cityId, coords) === cityId;
  }).length;
}

/** Города для списков UI (менеджер, маршруты, поиск) — без подрайонов */
export function catalogCitiesListed(catalog: Catalog): City[] {
  return catalog.cities.filter((c) => !isFineGrainedCity(c));
}

function citiesFromVisiblePlaces(catalog: Catalog, visiblePlaces: Place[]): City[] {
  const byId = new Map<string, City>();
  for (const p of visiblePlaces) {
    const coords =
      p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : undefined;
    const resolved =
      parentCityForPlaceCity(catalog, p.cityId, coords) ?? cityById(catalog, p.cityId);
    if (resolved && !isFineGrainedCity(resolved)) byId.set(resolved.id, resolved);
  }
  return [...byId.values()];
}

/** Название города для отображения у места (подрайон → ближайший город) */
export function cityLabelForPlace(catalog: Catalog, place: Place): string {
  const coords =
    place.lat != null && place.lng != null
      ? { lat: place.lat, lng: place.lng }
      : undefined;
  const resolved =
    parentCityForPlaceCity(catalog, place.cityId, coords) ??
    cityById(catalog, place.cityId);
  return resolved?.name ?? place.cityId;
}

/** Города для заливки и меток на «Всё»/«Города» — без подрайонов внутри основного города */
function allCatalogCitiesForMap(catalog: Catalog): City[] {
  return catalog.cities.filter((c) => !isFineGrainedCity(c));
}

/** Границы на карте: на «Всё»/«Города» — все города; на табах категорий — только релевантные */
export function citiesForMapBoundaries(
  catalog: Catalog,
  filter: CategoryFilter,
  visiblePlaces: Place[],
): City[] {
  if (filter === 'cities' || filter === 'all') {
    return allCatalogCitiesForMap(catalog);
  }
  return citiesFromVisiblePlaces(catalog, visiblePlaces);
}

/** Метки городов: на «Всё»/«Города» — без подрайонов; на табах категорий — только с видимыми местами */
export function citiesForMapMarkers(
  catalog: Catalog,
  filter: CategoryFilter,
  visiblePlaces: Place[],
): City[] {
  if (filter === 'cities' || filter === 'all') return allCatalogCitiesForMap(catalog);
  return citiesFromVisiblePlaces(catalog, visiblePlaces);
}

function normalizeCityToken(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е');
}

const PHOTON_NEAREST_MAX_KM = 35;

function citiesForMatching(pool: City[]): City[] {
  return pool.filter((c) => !isFineGrainedCity(c));
}

function orderedLocalityHints(hints: readonly string[]): string[] {
  return [...hints].sort((a, b) => {
    const af = isFineGrainedLocality(a) ? 1 : 0;
    const bf = isFineGrainedLocality(b) ? 1 : 0;
    return af - bf;
  });
}

/**
 * Подобрать id города из каталога по данным Photon (названия + координаты).
 * Подрайоны в каталоге и в подсказках игнорируются.
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
  const hints = orderedLocalityHints(localityHints).map(normalizeCityToken).filter(Boolean);

  const inCountry = cc
    ? catalog.cities.filter((c) => c.countryCode.toUpperCase() === cc)
    : catalog.cities;

  const matchPool = citiesForMatching(inCountry.length > 0 ? inCountry : catalog.cities);

  const tryExact = (pool: City[]) => {
    for (const h of hints) {
      if (isFineGrainedLocality(h)) continue;
      for (const city of pool) {
        if (normalizeCityToken(city.name) === h) return city.id;
      }
    }
    return undefined;
  };

  const exact = tryExact(matchPool);
  if (exact) return exact;

  const tryPartial = (pool: City[]) => {
    for (const h of hints) {
      if (isFineGrainedLocality(h)) continue;
      for (const city of pool) {
        const cn = normalizeCityToken(city.name);
        if (h.includes(cn) || cn.includes(h)) return city.id;
      }
    }
    return undefined;
  };

  const partial = tryPartial(matchPool);
  if (partial) return partial;

  let best: { id: string; d: number } | null = null;
  for (const city of matchPool) {
    const d = distanceKm(lat, lng, city.lat, city.lng);
    if (!best || d < best.d) best = { id: city.id, d };
  }
  if (best && best.d <= PHOTON_NEAREST_MAX_KM) return best.id;

  return undefined;
}

export type PlaceCitySuggestion = {
  lat: number;
  lng: number;
  localityHints: readonly string[];
  countryCodeOsm?: string;
  cityName?: string;
};

/**
 * Id города для нового места: только «настоящие» города, без подрайонов.
 */
export function resolvePlaceCityId(
  catalog: Catalog,
  extraCities: City[],
  suggestion: PlaceCitySuggestion,
): string | undefined {
  const allCities = [...catalog.cities, ...extraCities];
  const merged: Catalog = { cities: allCities, places: catalog.places };
  const cc = suggestion.countryCodeOsm?.toUpperCase();
  const norm = (str: string) =>
    str.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

  let resolved = catalogCityIdFromPhotonHints(
    merged,
    suggestion.lat,
    suggestion.lng,
    suggestion.localityHints,
    suggestion.countryCodeOsm,
  );

  if (!resolved && cc) {
    const namesToTry = orderedLocalityHints([
      ...(suggestion.cityName ? [suggestion.cityName] : []),
      ...suggestion.localityHints,
    ]);

    for (const name of namesToTry) {
      if (isFineGrainedLocality(name)) continue;
      const match = citiesForMatching(allCities).find(
        (c) => c.countryCode.toUpperCase() === cc && norm(c.name) === norm(name),
      );
      if (match) {
        resolved = match.id;
        break;
      }
    }
  }

  if (resolved) {
    return canonicalCityId(merged, resolved, {
      lat: suggestion.lat,
      lng: suggestion.lng,
    });
  }

  if (!cc) return undefined;

  const createName = [
    suggestion.cityName,
    ...orderedLocalityHints(suggestion.localityHints),
  ].find((n) => typeof n === 'string' && n.trim() && !isFineGrainedLocality(n));

  if (!createName) return undefined;

  const nameNorm = norm(createName);
  const existing = citiesForMatching(allCities).find(
    (c) => c.countryCode.toUpperCase() === cc && norm(c.name) === nameNorm,
  );
  if (existing) return existing.id;

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
