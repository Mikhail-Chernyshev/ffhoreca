import type { City, TravelRoute, UserRouteMode } from '../../src/data/types';
import { FIELD_LIMITS, hasMaxLen } from './security';

const ROUTE_MODES = new Set<UserRouteMode>(['plane', 'train', 'bus', 'boat', 'car']);

export function isValidCity(x: unknown): x is City {
  if (x == null || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  return (
    hasMaxLen(c.id, FIELD_LIMITS.id)
    && hasMaxLen(c.name, FIELD_LIMITS.name)
    && typeof c.countryCode === 'string'
    && c.countryCode.trim().length === 2
    && typeof c.lat === 'number'
    && typeof c.lng === 'number'
  );
}

export function isValidRoute(x: unknown): x is TravelRoute {
  if (x == null || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  if (!hasMaxLen(r.id, FIELD_LIMITS.id)) return false;
  if (!Array.isArray(r.waypoints) || r.waypoints.length < 2) return false;
  if (r.waypoints.length > FIELD_LIMITS.waypointsMax) return false;
  for (const w of r.waypoints) {
    if (w == null || typeof w !== 'object') return false;
    const wp = w as Record<string, unknown>;
    if (!hasMaxLen(wp.cityId, FIELD_LIMITS.id)) return false;
    if (!hasMaxLen(wp.name, FIELD_LIMITS.waypointName)) return false;
    if (typeof wp.lat !== 'number' || typeof wp.lng !== 'number') return false;
    if (wp.placeId != null && !hasMaxLen(wp.placeId, FIELD_LIMITS.id)) return false;
  }
  if (typeof r.mode !== 'string' || !ROUTE_MODES.has(r.mode as UserRouteMode)) return false;
  return true;
}
