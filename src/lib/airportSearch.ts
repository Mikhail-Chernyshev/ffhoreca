/**
 * Поиск аэропортов для авиамаршрута.
 * Google Places (includedType=airport) при наличии ключа, иначе Photon/OSM.
 */

import { photonLangForQuery, searchLanguageForQuery } from './searchLocale';
import {
  isFineGrainedLocality,
  type AddressSuggestion,
} from './photonAddressSearch';

export type AirportSuggestion = AddressSuggestion & {
  /** Google Place ID без префикса places/ — для стабильного id в каталоге */
  googlePlaceId?: string;
};

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

interface GooglePlace {
  id?: string;
  name?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
}

function googlePlaceIdOf(p: GooglePlace): string | undefined {
  if (typeof p.id === 'string' && p.id.trim()) return p.id.trim();
  const name = p.name?.trim();
  if (name?.startsWith('places/')) return name.slice('places/'.length);
  return undefined;
}

function parseGoogleAirport(p: GooglePlace): AirportSuggestion | null {
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const placeName = p.displayName?.text?.trim() ?? '';
  if (!placeName) return null;
  const label = p.formattedAddress?.trim() || placeName;

  const localityHints: string[] = [];
  let countryCodeOsm: string | undefined;
  let cityName: string | undefined;

  const hintTypes = new Set([
    'locality',
    'postal_town',
    'administrative_area_level_1',
    'administrative_area_level_2',
    'colloquial_area',
    'neighborhood',
    'sublocality',
    'sublocality_level_1',
  ]);

  const cityNameTypes = [
    'locality',
    'postal_town',
    'administrative_area_level_2',
    'administrative_area_level_1',
    'colloquial_area',
  ] as const;

  for (const comp of p.addressComponents ?? []) {
    const types = comp.types ?? [];
    const longText = comp.longText?.trim() ?? '';
    const shortText = comp.shortText?.trim() ?? '';
    if (types.includes('country') && shortText.length === 2) {
      countryCodeOsm = shortText.toUpperCase();
    }
    if (longText && types.some((t) => hintTypes.has(t))) {
      localityHints.push(longText);
    }
  }

  for (const priorityType of cityNameTypes) {
    for (const comp of p.addressComponents ?? []) {
      const types = comp.types ?? [];
      const longText = comp.longText?.trim();
      if (types.includes(priorityType) && longText && !isFineGrainedLocality(longText)) {
        cityName = longText;
        break;
      }
    }
    if (cityName) break;
  }

  const uniqueHints = [...new Set(localityHints)];
  const broadHints = uniqueHints.filter((h) => !isFineGrainedLocality(h));
  const orderedHints = [
    ...broadHints,
    ...uniqueHints.filter((h) => isFineGrainedLocality(h)),
  ];

  return {
    placeName,
    label,
    lng,
    lat,
    localityHints: orderedHints,
    countryCodeOsm,
    cityName,
    googleRating: typeof p.rating === 'number' ? p.rating : undefined,
    googlePlaceId: googlePlaceIdOf(p),
  };
}

async function searchGoogleAirports(
  query: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<AirportSuggestion[] | null> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.name,places.displayName,places.formattedAddress,places.location,places.addressComponents,places.rating',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: searchLanguageForQuery(query),
      maxResultCount: 10,
      includedType: 'airport',
      strictTypeFiltering: true,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as GooglePlacesResponse;
  const out: AirportSuggestion[] = [];
  for (const place of data.places ?? []) {
    const s = parseGoogleAirport(place);
    if (s) out.push(s);
  }
  return out;
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};

function looksLikeAirport(p: Record<string, unknown>): boolean {
  const osmKey = String(p.osm_key ?? '').toLowerCase();
  const osmValue = String(p.osm_value ?? '').toLowerCase();
  const type = String(p.type ?? '').toLowerCase();
  const name = String(p.name ?? '').toLowerCase();
  if (osmKey === 'aeroway') return true;
  if (osmValue.includes('aerodrome') || osmValue.includes('airport')) return true;
  if (type === 'airport' || type === 'aerodrome') return true;
  if (/\b(airport|aéroport|aeropuerto|аэропорт|flughafen)\b/i.test(name)) return true;
  return false;
}

function parsePhotonAirport(f: PhotonFeature): AirportSuggestion | null {
  const coords = f.geometry?.coordinates;
  const p = f.properties;
  if (!coords || !p || !looksLikeAirport(p)) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const placeName = (typeof p.name === 'string' && p.name.trim()) || 'Airport';
  const city =
    (p.city as string | undefined) ||
    (p.town as string | undefined) ||
    (p.village as string | undefined) ||
    (p.locality as string | undefined);
  const country = p.country as string | undefined;
  const countrycode = p.countrycode;
  const countryCodeOsm =
    typeof countrycode === 'string' && countrycode.length >= 2
      ? countrycode.slice(0, 2).toUpperCase()
      : undefined;

  const localityHints = [city, p.state as string | undefined]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim());

  const label = [placeName, city, country].filter(Boolean).join(', ');

  return {
    placeName,
    label,
    lng,
    lat,
    localityHints: [...new Set(localityHints)],
    countryCodeOsm,
    cityName: typeof city === 'string' ? city.trim() : undefined,
  };
}

async function searchPhotonAirports(
  query: string,
  signal?: AbortSignal,
): Promise<AirportSuggestion[]> {
  const lang = photonLangForQuery(query);
  const q = /\b(airport|аэропорт|aéroport)\b/i.test(query)
    ? query
    : `${query} airport`;

  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '12');
  url.searchParams.set('lang', lang);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: PhotonFeature[] };
  const out: AirportSuggestion[] = [];
  for (const f of data.features ?? []) {
    const s = parsePhotonAirport(f);
    if (s) out.push(s);
  }
  return out;
}

function dedupeAirports(list: AirportSuggestion[]): AirportSuggestion[] {
  const seen = new Set<string>();
  const out: AirportSuggestion[] = [];
  for (const s of list) {
    const key =
      s.googlePlaceId ??
      `${s.placeName.toLowerCase()}|${s.lat.toFixed(3)}|${s.lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Поиск аэропортов по названию города или аэропорта (мин. 2 символа). */
export async function searchAirports(
  query: string,
  signal?: AbortSignal,
): Promise<AirportSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (GOOGLE_API_KEY) {
    try {
      const google = await searchGoogleAirports(q, GOOGLE_API_KEY, signal);
      if (google && google.length > 0) return dedupeAirports(google);
      // пустой ответ — не ошибка; всё равно пробуем Photon как доп. источник
      if (google === null) {
        /* API error → Photon */
      } else if (google.length === 0) {
        return dedupeAirports(await searchPhotonAirports(q, signal));
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
    }
  }

  return dedupeAirports(await searchPhotonAirports(q, signal));
}
