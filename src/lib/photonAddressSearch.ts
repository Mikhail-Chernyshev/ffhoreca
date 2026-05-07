/**
 * Поиск мест для модалки «Новое место».
 *
 * Если задан VITE_GOOGLE_PLACES_API_KEY — используется Google Places API (New, v1).
 * Иначе — Photon (OpenStreetMap, бесплатно, без ключа, менее полные данные по бизнесам).
 */

export type AddressSuggestion = {
  /** Короткое имя для поля «Название» (POI, улица с домом и т.д.) */
  placeName: string;
  /** Полная строка для поля «Адрес» */
  label: string;
  lng: number;
  lat: number;
  /** Названия населённых пунктов из OSM — для сопоставления с каталогом городов */
  localityHints: string[];
  /** ISO alpha-2, если есть */
  countryCodeOsm?: string;
  /** Оценка Google (0–5), если API вернул */
  googleRating?: number;
};

// ---------------------------------------------------------------------------
// Google Places API (New, v1) — требует VITE_GOOGLE_PLACES_API_KEY
// ---------------------------------------------------------------------------

interface GooglePlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  addressComponents?: Array<{
    longText?: string;
    types?: string[];
  }>;
}

interface GooglePlacesResponse {
  places?: GooglePlace[];
}

function parseGooglePlace(p: GooglePlace): AddressSuggestion | null {
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const placeName = p.displayName?.text ?? '';
  const label = p.formattedAddress ?? placeName;

  const localityHints: string[] = [];
  let countryCodeOsm: string | undefined;

  for (const comp of p.addressComponents ?? []) {
    const types = comp.types ?? [];
    const text = comp.longText ?? '';
    if (!text) continue;
    if (
      types.includes('locality') ||
      types.includes('sublocality') ||
      types.includes('administrative_area_level_2') ||
      types.includes('administrative_area_level_1')
    ) {
      localityHints.push(text);
    }
    if (types.includes('country')) {
      // addressComponents дают длинное имя страны; ISO code берём отдельно
    }
  }

  const googleRating = typeof p.rating === 'number' ? p.rating : undefined;
  return { placeName, label, lng, lat, localityHints, countryCodeOsm, googleRating };
}

async function searchGooglePlaces(
  query: string,
  bias: { lat: number; lng: number } | undefined,
  apiKey: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: 'ru',
    maxResultCount: 10,
  };

  if (bias) {
    body.locationBias = {
      circle: {
        center: { latitude: bias.lat, longitude: bias.lng },
        radius: 50000, // 50 км
      },
    };
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.displayName,places.formattedAddress,places.location,places.addressComponents,places.rating',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as GooglePlacesResponse;
  const results: AddressSuggestion[] = [];
  for (const place of data.places ?? []) {
    const s = parseGooglePlace(place);
    if (s) results.push(s);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Photon (OSM) — бесплатно, без ключа
// ---------------------------------------------------------------------------

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};

function formatPhotonLabel(p: Record<string, unknown>): string {
  const street = [p.street, p.housenumber].filter(Boolean).join(' ').trim();
  const head = [p.name, street].filter(Boolean).join(', ');
  const locality =
    (p.city || p.locality || p.town || p.village || p.district || p.county) as
      | string
      | undefined;
  const country = p.country as string | undefined;
  const parts = [head || (p.name as string), locality, country].filter(
    (x): x is string => typeof x === 'string' && x.length > 0,
  );
  const uniq = [...new Set(parts)];
  const s = uniq.join(', ');
  return s || 'Без названия';
}

function localityHintsFromPhotonProps(p: Record<string, unknown>): string[] {
  const keys = ['city', 'locality', 'town', 'village', 'district', 'county'] as const;
  const out: string[] = [];
  for (const k of keys) {
    const v = p[k];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
  }
  return [...new Set(out)];
}

function countryCodeFromPhotonProps(p: Record<string, unknown>): string | undefined {
  const c = p.countrycode;
  if (typeof c === 'string' && c.length >= 2) return c.slice(0, 2).toUpperCase();
  return undefined;
}

function placeNameFromPhotonProps(p: Record<string, unknown>): string {
  const n = p.name;
  if (typeof n === 'string' && n.trim()) return n.trim();
  const street = [p.street, p.housenumber].filter(Boolean).join(' ').trim();
  if (street) return street;
  const loc = (p.city || p.locality || p.town || p.village) as string | undefined;
  if (typeof loc === 'string' && loc.trim()) return loc.trim();
  return formatPhotonLabel(p);
}

async function searchPhoton(
  query: string,
  bias: { lat: number; lng: number } | undefined,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: '10', lang: 'ru' });
  if (bias) {
    params.set('lat', String(bias.lat));
    params.set('lon', String(bias.lng));
  }

  const res = await fetch(`https://photon.komoot.io/api/?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: PhotonFeature[] };
  const out: AddressSuggestion[] = [];

  for (const f of data.features ?? []) {
    const coords = f.geometry?.coordinates;
    const p = f.properties;
    if (!coords || coords.length < 2 || !p) continue;
    const [lng, lat] = coords;
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    out.push({
      placeName: placeNameFromPhotonProps(p),
      label: formatPhotonLabel(p),
      lng,
      lat,
      localityHints: localityHintsFromPhotonProps(p),
      countryCodeOsm: countryCodeFromPhotonProps(p),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Публичная функция
// ---------------------------------------------------------------------------

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

export async function searchPhotonAddresses(
  query: string,
  bias: { lat: number; lng: number } | undefined,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  if (GOOGLE_API_KEY) {
    return searchGooglePlaces(q, bias, GOOGLE_API_KEY, signal);
  }
  return searchPhoton(q, bias, signal);
}
