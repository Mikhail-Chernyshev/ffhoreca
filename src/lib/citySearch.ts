/**
 * Поиск городов для модалки «Новый город».
 *
 * Если задан VITE_GOOGLE_PLACES_API_KEY — Google Places API (New, v1).
 * Иначе — Photon (OpenStreetMap) как запасной вариант без ключа.
 */

import {
  isForeignScriptName,
  photonLangForQuery,
  pickReadablePlaceName,
  searchLanguageForQuery,
} from './searchLocale';

export type CitySuggestion = {
  name: string;
  /** Полная строка с регионом и страной */
  label: string;
  lng: number;
  lat: number;
  /** ISO alpha-2, если есть */
  countryCode?: string;
};

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

// ---------------------------------------------------------------------------
// Google Places API (New, v1)
// ---------------------------------------------------------------------------

interface GooglePlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  types?: string[];
  primaryType?: string;
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
}

const NON_CITY_TYPES = new Set([
  'street_address',
  'route',
  'intersection',
  'premise',
  'subpremise',
  'establishment',
  'point_of_interest',
  'store',
  'restaurant',
  'lodging',
  'airport',
  'transit_station',
  'parking',
  'gas_station',
]);

const CITY_TYPES = new Set([
  'locality',
  'postal_town',
  'colloquial_area',
  'sublocality',
  'sublocality_level_1',
  'neighborhood',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'administrative_area_level_4',
]);

function isCityPlace(p: GooglePlace): boolean {
  const types = [...(p.types ?? []), p.primaryType].filter(
    (t): t is string => typeof t === 'string' && t.length > 0,
  );
  if (types.some((t) => NON_CITY_TYPES.has(t))) return false;
  if (types.some((t) => CITY_TYPES.has(t))) return true;
  // Например «Амед»: colloquial_area + political
  return types.includes('political') && Boolean(p.displayName?.text?.trim());
}

function parseGoogleCity(p: GooglePlace, query: string): CitySuggestion | null {
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!isCityPlace(p)) return null;

  let name = p.displayName?.text?.trim() ?? '';
  let countryCode: string | undefined;
  const altNames: string[] = [];

  for (const comp of p.addressComponents ?? []) {
    const types = comp.types ?? [];
    const longText = comp.longText?.trim() ?? '';
    const shortText = comp.shortText?.trim() ?? '';
    if (types.includes('country') && shortText.length === 2) {
      countryCode = shortText.toUpperCase();
    }
    if (
      longText &&
      (types.includes('locality') ||
        types.includes('colloquial_area') ||
        types.includes('postal_town') ||
        types.includes('administrative_area_level_1') ||
        types.includes('administrative_area_level_2'))
    ) {
      altNames.push(longText);
      if (
        !name &&
        (types.includes('locality') ||
          types.includes('colloquial_area') ||
          types.includes('postal_town'))
      ) {
        name = longText;
      }
    }
  }

  name = pickReadablePlaceName(name, query, altNames);
  if (!name) return null;

  const labelRaw = p.formattedAddress?.trim() || name;
  const label = isForeignScriptName(labelRaw, query)
    ? pickReadablePlaceName(labelRaw, query, [name, ...altNames])
    : labelRaw;

  return {
    name,
    label,
    lng,
    lat,
    countryCode,
  };
}

async function searchGoogleCities(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.displayName,places.formattedAddress,places.location,places.addressComponents,places.types,places.primaryType',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: searchLanguageForQuery(query),
      maxResultCount: 10,
    }),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as GooglePlacesResponse;
  return dedupeCitySuggestions(
    (data.places ?? [])
      .map((p) => parseGoogleCity(p, query))
      .filter((s): s is CitySuggestion => s != null),
  );
}

// ---------------------------------------------------------------------------
// Photon (OSM) — запасной вариант без ключа
// ---------------------------------------------------------------------------

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};

const PLACE_TYPES = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'municipality',
  'locality',
  'suburb',
]);

function formatPhotonLabel(p: Record<string, unknown>, name: string): string {
  const state = p.state as string | undefined;
  const country = p.country as string | undefined;
  const parts = [name, state, country].filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0,
  );
  return [...new Set(parts)].join(', ') || name;
}

function cityNameFromPhotonProps(p: Record<string, unknown>): string {
  const n = p.name;
  if (typeof n === 'string' && n.trim()) return n.trim();
  const loc = (p.city || p.locality || p.town || p.village) as string | undefined;
  if (typeof loc === 'string' && loc.trim()) return loc.trim();
  return 'Без названия';
}

function countryCodeFromPhotonProps(p: Record<string, unknown>): string | undefined {
  const c = p.countrycode;
  if (typeof c === 'string' && c.length >= 2) return c.slice(0, 2).toUpperCase();
  return undefined;
}

function isPlaceFeature(p: Record<string, unknown>): boolean {
  const osmKey = p.osm_key;
  if (osmKey === 'place') return true;
  const type = p.type;
  if (typeof type === 'string' && PLACE_TYPES.has(type)) return true;
  const osmValue = p.osm_value;
  if (typeof osmValue === 'string' && PLACE_TYPES.has(osmValue)) return true;
  return false;
}

function parsePhotonCityFeature(f: PhotonFeature): CitySuggestion | null {
  const coords = f.geometry?.coordinates;
  const p = f.properties;
  if (!coords || coords.length < 2 || !p) return null;
  if (!isPlaceFeature(p)) return null;

  const [lng, lat] = coords;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;

  const name = cityNameFromPhotonProps(p);
  return {
    name,
    label: formatPhotonLabel(p, name),
    lng,
    lat,
    countryCode: countryCodeFromPhotonProps(p),
  };
}

function photonCoordKey(lat: number, lng: number): string {
  return `${Math.round(lat * 1000)}|${Math.round(lng * 1000)}`;
}

function localizePhotonCitySuggestion(
  s: CitySuggestion,
  query: string,
  enByCoord: Map<string, CitySuggestion>,
): CitySuggestion {
  const en = enByCoord.get(photonCoordKey(s.lat, s.lng));
  const altNames = en ? [en.name] : [];
  const name = pickReadablePlaceName(s.name, query, altNames);
  const labelRaw = isForeignScriptName(s.label, query) && en ? en.label : s.label;
  const label = isForeignScriptName(labelRaw, query)
    ? pickReadablePlaceName(labelRaw, query, [name, ...(en ? [en.label] : [])])
    : labelRaw;
  return { ...s, name, label };
}

async function fetchPhotonCitiesRaw(
  query: string,
  lang: 'default' | 'en',
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '12',
    lang,
  });
  for (const tag of ['place:city', 'place:town', 'place:village', 'place:hamlet']) {
    params.append('osm_tag', tag);
  }

  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: PhotonFeature[] };
  return (data.features ?? [])
    .map(parsePhotonCityFeature)
    .filter((s): s is CitySuggestion => s != null);
}

async function searchPhotonCities(
  query: string,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const lang = photonLangForQuery(query);
  const primary = await fetchPhotonCitiesRaw(query, lang, signal);

  if (lang !== 'default') {
    return dedupeCitySuggestions(
      primary.map((s) => localizePhotonCitySuggestion(s, query, new Map())),
    );
  }

  const needsEn = primary.some((s) => isForeignScriptName(s.name, query));
  if (!needsEn) {
    return dedupeCitySuggestions(
      primary.map((s) => localizePhotonCitySuggestion(s, query, new Map())),
    );
  }

  const en = await fetchPhotonCitiesRaw(query, 'en', signal);
  const enByCoord = new Map<string, CitySuggestion>();
  for (const s of en) enByCoord.set(photonCoordKey(s.lat, s.lng), s);

  return dedupeCitySuggestions(
    primary.map((s) => localizePhotonCitySuggestion(s, query, enByCoord)),
  );
}

function dedupeCitySuggestions(list: CitySuggestion[]): CitySuggestion[] {
  const out: CitySuggestion[] = [];
  const seen = new Set<string>();

  for (const s of list) {
    const key = `${s.name.toLowerCase()}|${s.countryCode ?? ''}|${Math.round(s.lat * 100)}|${Math.round(s.lng * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Публичная функция
// ---------------------------------------------------------------------------

export async function searchCities(
  query: string,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (GOOGLE_API_KEY) {
    return searchGoogleCities(q, GOOGLE_API_KEY, signal);
  }
  return searchPhotonCities(q, signal);
}
