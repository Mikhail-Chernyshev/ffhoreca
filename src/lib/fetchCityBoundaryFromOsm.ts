import type { City } from '../data/types';
import { latinSearchHint } from './transliterate';

interface NominatimResult {
  lat?: string;
  lon?: string;
  name?: string;
  geojson?: unknown;
  category?: string;
  type?: string;
  place_rank?: number;
  boundingbox?: string[];
}

const osmBoundaryCache = new Map<string, unknown | null>();

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'ffhoreca-travel-map/1.0',
};

/** Минимальная площадь bbox — отсекаем полигоны зданий (Villa Moana и т.п.) */
const MIN_BBOX_AREA_KM2 = 0.5;

const BOUNDARY_CATEGORIES = new Set(['place', 'boundary']);

const AREA_GEOJSON_TYPES = new Set(['Polygon', 'MultiPolygon']);

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е');
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

function isAreaGeojson(geojson: unknown): geojson is { type: string } {
  if (geojson == null || typeof geojson !== 'object') return false;
  const t = (geojson as { type?: string }).type;
  return typeof t === 'string' && AREA_GEOJSON_TYPES.has(t);
}

function bboxAreaKm2(bbox?: string[]): number {
  if (!bbox || bbox.length < 4) return 0;
  const south = Number(bbox[0]);
  const north = Number(bbox[1]);
  const west = Number(bbox[2]);
  const east = Number(bbox[3]);
  if ([south, north, west, east].some(Number.isNaN)) return 0;
  const latMid = (south + north) / 2;
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((latMid * Math.PI) / 180);
  return Math.abs(north - south) * kmPerDegLat * Math.abs(east - west) * kmPerDegLng;
}

/** Подходит ли результат Nominatim как граница города/поселения */
function isBoundaryCandidate(r: NominatimResult): boolean {
  if (!isAreaGeojson(r.geojson)) return false;
  const cat = r.category ?? '';
  if (!BOUNDARY_CATEGORIES.has(cat)) return false;
  if (bboxAreaKm2(r.boundingbox) < MIN_BBOX_AREA_KM2) return false;
  return true;
}

function pickBestNominatimResult(results: NominatimResult[], city: City): NominatimResult | null {
  const candidates = results.filter(isBoundaryCandidate);
  if (candidates.length === 0) return null;

  const cityNorm = normName(city.name);
  const latinNorm = latinSearchHint(city.name);
  const nameMatch = candidates.find((r) => {
    if (!r.name) return false;
    const n = normName(r.name);
    return n === cityNorm || (latinNorm != null && n === normName(latinNorm));
  });
  if (nameMatch) return nameMatch;

  let best: NominatimResult | null = null;
  let bestDist = Infinity;
  for (const r of candidates) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const d = distanceKm(city.lat, city.lng, lat, lng);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}

async function reverseGeocodeBoundary(
  city: City,
  signal?: AbortSignal,
): Promise<unknown | null> {
  for (const zoom of [13, 12, 11]) {
    const reverseParams = new URLSearchParams({
      lat: String(city.lat),
      lon: String(city.lng),
      format: 'jsonv2',
      polygon_geojson: '1',
      zoom: String(zoom),
    });
    const reverseRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${reverseParams}`,
      { signal, headers: NOMINATIM_HEADERS },
    );
    if (!reverseRes.ok) continue;
    const reverse = (await reverseRes.json()) as NominatimResult;
    if (isBoundaryCandidate(reverse)) return reverse.geojson;
    if (isAreaGeojson(reverse.geojson) && (reverse.category === 'boundary' || reverse.category === 'place')) {
      return reverse.geojson;
    }
  }
  return null;
}

async function searchBoundary(
  query: string,
  city: City,
  signal?: AbortSignal,
): Promise<unknown | null> {
  const searchParams = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    polygon_geojson: '1',
    limit: '10',
    countrycodes: city.countryCode.toLowerCase(),
  });
  const searchRes = await fetch(
    `https://nominatim.openstreetmap.org/search?${searchParams}`,
    { signal, headers: NOMINATIM_HEADERS },
  );
  if (!searchRes.ok) return null;
  const results = (await searchRes.json()) as NominatimResult[];
  const picked = pickBestNominatimResult(results, city)?.geojson ?? null;
  return isAreaGeojson(picked) ? picked : null;
}

/**
 * Граница города из OpenStreetMap (Nominatim), если нет файла public/geo/cities/{id}.json.
 */
export async function fetchCityBoundaryFromOsm(
  city: City,
  signal?: AbortSignal,
): Promise<unknown | null> {
  const cached = osmBoundaryCache.get(city.id);
  if (cached !== undefined) {
    return isAreaGeojson(cached) ? cached : null;
  }

  let geojson: unknown | null = null;

  // 1. Reverse по координатам — надёжнее для «Амед» и подобных
  try {
    geojson = await reverseGeocodeBoundary(city, signal);
  } catch {
    geojson = null;
  }

  // 2. Поиск по имени — только place/boundary с достаточной площадью
  if (!geojson) {
    const searchQueries = [
      city.name,
      latinSearchHint(city.name),
    ].filter((q): q is string => typeof q === 'string' && q.trim().length >= 2);

    try {
      for (const q of searchQueries) {
        geojson = await searchBoundary(q, city, signal);
        if (geojson) break;
      }
    } catch {
      geojson = null;
    }
  }

  osmBoundaryCache.set(city.id, geojson);
  return geojson;
}

/** Nominatim: не чаще ~1 запроса в секунду */
export const NOMINATIM_MIN_INTERVAL_MS = 1100;
