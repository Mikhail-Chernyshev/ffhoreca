import type { Catalog } from '../data/types';
import {
  bearingDegrees,
  greatCircleArc,
  haversineKm,
  type LngLatDeg,
} from './greatCircle';

/** Центр Санкт-Петербурга (если города ещё нет в каталоге). */
export const SAINT_PETERSBURG_DEFAULT_LNG = 30.31413;
export const SAINT_PETERSBURG_DEFAULT_LAT = 59.9375;

const MIN_ROUTE_KM = 120;

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е');
}

/** Берём координаты из каталога, если есть Санкт-Петербург / SPb. */
export function resolveSaintPetersburgCoords(catalog: Catalog): {
  lng: number;
  lat: number;
} {
  for (const c of catalog.cities) {
    const id = c.id.toLowerCase();
    const name = normalizeName(c.name);
    if (
      id.includes('saint-petersburg') ||
      id.includes('spb') ||
      id === 'ru-spb' ||
      name.includes('санкт-петербург') ||
      name.includes('петербург')
    ) {
      return { lng: c.lng, lat: c.lat };
    }
  }
  return { lng: SAINT_PETERSBURG_DEFAULT_LNG, lat: SAINT_PETERSBURG_DEFAULT_LAT };
}

export type FlightRouteToSpb = {
  originCityId: string;
  /** Линия для GeoJSON [lng, lat][] */
  coordinates: LngLatDeg[];
};

export function buildRoutesToSaintPetersburg(catalog: Catalog): FlightRouteToSpb[] {
  const dest = resolveSaintPetersburgCoords(catalog);
  const routes: FlightRouteToSpb[] = [];

  for (const city of catalog.cities) {
    const km = haversineKm(city.lat, city.lng, dest.lat, dest.lng);
    if (km < MIN_ROUTE_KM) continue;

    const coordinates = greatCircleArc(
      city.lng,
      city.lat,
      dest.lng,
      dest.lat,
      56,
    );

    routes.push({ originCityId: city.id, coordinates });
  }

  return routes;
}

function interpolateAlongArc(
  coordinates: LngLatDeg[],
  t01: number,
): { lng: number; lat: number } {
  const n = coordinates.length;
  const pos = Math.min(1, Math.max(0, t01)) * (n - 1);
  const i = Math.min(Math.floor(pos), n - 2);
  const f = pos - i;
  const [lng1, lat1] = coordinates[i];
  const [lng2, lat2] = coordinates[i + 1];
  return {
    lng: lng1 + (lng2 - lng1) * f,
    lat: lat1 + (lat2 - lat1) * f,
  };
}

/**
 * Один цикл анимации 0…1: сначала перелёт к Петербургу (t: 0→1), затем обратно в город (t: 1→0).
 */
export function positionAndBearingRoundTripOnArc(
  coordinates: LngLatDeg[],
  cycle01: number,
): { lng: number; lat: number; bearing: number } | null {
  if (coordinates.length < 2) return null;
  const p = Math.min(1, Math.max(0, cycle01));
  const toSpb = p < 0.5;
  /** Параметр вдоль дуги «город → СПб»: туда t↑, обратно t↓ */
  const t = toSpb ? p * 2 : 2 - p * 2;

  const pos = interpolateAlongArc(coordinates, t);
  const n = coordinates.length;
  const eps = 1 / ((n - 1) * 24);

  let bearing: number;
  if (toSpb) {
    const t2 = Math.min(1, t + eps);
    const pos2 = interpolateAlongArc(coordinates, t2);
    bearing = bearingDegrees(pos.lng, pos.lat, pos2.lng, pos2.lat);
  } else {
    const t2 = Math.max(0, t - eps);
    const pos2 = interpolateAlongArc(coordinates, t2);
    if (t < eps) {
      const pNear = interpolateAlongArc(coordinates, Math.min(1, t + eps));
      bearing = bearingDegrees(pNear.lng, pNear.lat, pos.lng, pos.lat);
    } else {
      bearing = bearingDegrees(pos.lng, pos.lat, pos2.lng, pos2.lat);
    }
  }

  return { lng: pos.lng, lat: pos.lat, bearing };
}
