import type { UserRouteMode } from '../data/types';
import type { LngLatDeg } from './greatCircle';

const OSRM_BASE =
  (import.meta.env.VITE_OSRM_BASE_URL as string | undefined)?.replace(/\/+$/, '') ??
  'https://router.project-osrm.org';

const routeCache = new Map<string, LngLatDeg[]>();

function cacheKey(
  profile: string,
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
): string {
  return [
    profile,
    fromLng.toFixed(5),
    fromLat.toFixed(5),
    toLng.toFixed(5),
    toLat.toFixed(5),
  ].join('|');
}

/** Авто и автобус — по дорогам; остальное — дуга на карте. */
export function usesRoadRouting(mode: UserRouteMode): boolean {
  return mode === 'car' || mode === 'bus';
}

function osrmProfile(_mode: UserRouteMode): 'driving' {
  return 'driving';
}

/**
 * Маршрут по дорогам через OSRM (OpenStreetMap).
 * Публичный сервер: router.project-osrm.org (можно переопределить VITE_OSRM_BASE_URL).
 */
export async function fetchOsrmRoadRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  mode: UserRouteMode,
  signal?: AbortSignal,
): Promise<LngLatDeg[] | null> {
  const profile = osrmProfile(mode);
  const key = cacheKey(profile, fromLng, fromLat, toLng, toLat);
  const cached = routeCache.get(key);
  if (cached) return cached;

  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'false',
  });
  const url = `${OSRM_BASE}/route/v1/${profile}/${coords}?${params}`;

  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{ geometry?: { coordinates?: LngLatDeg[] } }>;
  };
  if (data.code !== 'Ok') return null;

  const line = data.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(line) || line.length < 2) return null;

  routeCache.set(key, line);
  return line;
}
