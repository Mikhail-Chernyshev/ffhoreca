import type { City } from '../data/types';
import { cityBoundarySearchQueries } from './cityBoundaryLookup';
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

/** Reverse по центру мегаполиса часто даёт район/подрайон — доверяем только крупнее */
const REVERSE_MAX_TRUST_AREA_KM2 = 30;

/** Макс. расстояние от пина города до центра найденной границы */
const MAX_BOUNDARY_DISTANCE_KM = 80;

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

function resultDistanceKm(r: NominatimResult, city: City): number {
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return Infinity;
  return distanceKm(city.lat, city.lng, lat, lng);
}

/** Подходит ли результат Nominatim как граница города/поселения */
function isBoundaryCandidate(r: NominatimResult): boolean {
  if (!isAreaGeojson(r.geojson)) return false;
  const cat = r.category ?? '';
  if (!BOUNDARY_CATEGORIES.has(cat)) return false;
  if (bboxAreaKm2(r.boundingbox) < MIN_BBOX_AREA_KM2) return false;
  return true;
}

function namesMatchCity(r: NominatimResult, city: City): boolean {
  if (!r.name) return false;
  const cityNorm = normName(city.name);
  const latinNorm = latinSearchHint(city.name);
  const n = normName(r.name);
  return n === cityNorm || (latinNorm != null && n === normName(latinNorm));
}

/** Чем выше — тем лучше кандидат на границу всего города */
function boundaryScore(r: NominatimResult, city: City): number {
  const area = bboxAreaKm2(r.boundingbox);
  const rank = r.place_rank ?? 30;
  const dist = resultDistanceKm(r, city);
  let score = Math.log10(Math.max(area, 0.1)) * 12;
  score += Math.max(0, 22 - rank);
  score -= dist * 0.4;
  if (namesMatchCity(r, city)) score += 8;
  return score;
}

function pickBestNominatimResult(results: NominatimResult[], city: City): NominatimResult | null {
  const candidates = results.filter(isBoundaryCandidate);
  if (candidates.length === 0) return null;

  const nameMatch = candidates.find((r) => namesMatchCity(r, city));
  if (nameMatch) return nameMatch;

  const near = candidates.filter((r) => resultDistanceKm(r, city) <= MAX_BOUNDARY_DISTANCE_KM);
  const pool = near.length > 0 ? near : candidates;

  return pool.reduce<NominatimResult | null>((best, r) => {
    if (!best) return r;
    return boundaryScore(r, city) > boundaryScore(best, city) ? r : best;
  }, null);
}

/** Поиск по имени нашёл полноценную границу города — reverse не нужен */
function isStrongCityBoundary(r: NominatimResult): boolean {
  if (!isBoundaryCandidate(r)) return false;
  const area = bboxAreaKm2(r.boundingbox);
  const rank = r.place_rank ?? 99;
  return area >= REVERSE_MAX_TRUST_AREA_KM2 || rank <= 12;
}

function chooseBetterBoundary(
  search: NominatimResult | null,
  reverse: NominatimResult | null,
  city: City,
): NominatimResult | null {
  if (search && !reverse) return search;
  if (reverse && !search) return reverse;
  if (!search || !reverse) return null;

  const searchArea = bboxAreaKm2(search.boundingbox);
  const reverseArea = bboxAreaKm2(reverse.boundingbox);

  if (
    reverseArea < REVERSE_MAX_TRUST_AREA_KM2 &&
    searchArea > reverseArea * 2
  ) {
    return search;
  }

  if (searchArea > reverseArea * 1.5) return search;
  if (reverseArea > searchArea * 1.5) return reverse;

  return boundaryScore(search, city) >= boundaryScore(reverse, city) ? search : reverse;
}

async function reverseGeocodeBoundary(
  city: City,
  signal?: AbortSignal,
): Promise<NominatimResult | null> {
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
    if (isBoundaryCandidate(reverse)) return reverse;
  }
  return null;
}

async function searchBoundary(
  query: string,
  city: City,
  signal?: AbortSignal,
): Promise<NominatimResult | null> {
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
  return pickBestNominatimResult(results, city);
}

function geojsonFromResult(r: NominatimResult | null): unknown | null {
  if (!r?.geojson || !isAreaGeojson(r.geojson)) return null;
  return r.geojson;
}

/**
 * Граница города из OpenStreetMap (Nominatim).
 */
export async function fetchCityBoundaryFromOsm(
  city: City,
  signal?: AbortSignal,
): Promise<unknown | null> {
  const cached = osmBoundaryCache.get(city.id);
  if (cached != null && isAreaGeojson(cached)) {
    return cached;
  }

  let searchResult: NominatimResult | null = null;

  const searchQueries = cityBoundarySearchQueries(city);

  try {
    for (const q of searchQueries) {
      searchResult = await searchBoundary(q, city, signal);
      if (searchResult) break;
    }
  } catch {
    searchResult = null;
  }

  if (searchResult && isStrongCityBoundary(searchResult)) {
    const geojson = geojsonFromResult(searchResult);
    osmBoundaryCache.set(city.id, geojson);
    return geojson;
  }

  let reverseResult: NominatimResult | null = null;
  try {
    reverseResult = await reverseGeocodeBoundary(city, signal);
  } catch {
    reverseResult = null;
  }

  const picked = chooseBetterBoundary(searchResult, reverseResult, city);
  const geojson = geojsonFromResult(picked);
  if (geojson) {
    osmBoundaryCache.set(city.id, geojson);
  }
  return geojson;
}

/** Nominatim: не чаще ~1 запроса в секунду */
export const NOMINATIM_MIN_INTERVAL_MS = 1100;
