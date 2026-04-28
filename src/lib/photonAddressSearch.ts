/**
 * Поиск адресов через Photon (данные OpenStreetMap).
 * https://photon.komoot.io
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
  /** ISO alpha-2 из Photon (`countrycode`), если есть */
  countryCodeOsm?: string;
};

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

/** Имя места для карточки: приоритет name → улица+дом → населённый пункт */
function placeNameFromPhotonProps(p: Record<string, unknown>): string {
  const n = p.name;
  if (typeof n === 'string' && n.trim()) return n.trim();
  const street = [p.street, p.housenumber].filter(Boolean).join(' ').trim();
  if (street) return street;
  const loc = (p.city || p.locality || p.town || p.village) as string | undefined;
  if (typeof loc === 'string' && loc.trim()) return loc.trim();
  return formatPhotonLabel(p);
}

export async function searchPhotonAddresses(
  query: string,
  bias: { lat: number; lng: number } | undefined,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    q,
    limit: '10',
    lang: 'en',
  });
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
  const features = data.features ?? [];
  const out: AddressSuggestion[] = [];

  for (const f of features) {
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
