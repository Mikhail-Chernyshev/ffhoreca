import type { City } from '../../src/data/types';
import { FREEMIUM_LIMITS, FREEMIUM_LIMITS_ENFORCED, type MapVisibility, type UserSubscription } from '../../src/data/subscription';
import type { Database } from 'better-sqlite3';
import type { DbUser, UserUsage } from './db';
import {
  countUserCities,
  countUserPlaces,
  countUserRoutes,
  getUserUsage,
  userCountryCodes,
} from './db';

export function normalizeSubscription(value: unknown): UserSubscription {
  return value === 'premium' ? 'premium' : 'freemium';
}

export function normalizeMapVisibility(value: unknown): MapVisibility {
  return value === 'subscribers' ? 'subscribers' : 'public';
}

export function canViewUserMap(viewer: DbUser | null, owner: DbUser): boolean {
  const visibility = normalizeMapVisibility(owner.map_visibility);
  if (visibility === 'public') return true;
  return viewer?.id === owner.id;
}

export type LimitCode = 'countries' | 'cities' | 'routes' | 'places';

export type LimitCheckResult =
  | { ok: true }
  | { ok: false; code: LimitCode; limit: number };

function isPremium(user: DbUser): boolean {
  return normalizeSubscription(user.subscription) === 'premium';
}

/** Новый город в новой стране — лимит стран. */
export function checkFreemiumCountryLimit(
  db: Database,
  user: DbUser,
  city: City,
  isUpdate: boolean,
): LimitCheckResult {
  if (!FREEMIUM_LIMITS_ENFORCED) return { ok: true };
  if (isPremium(user)) return { ok: true };
  const codes = userCountryCodes(db, user.id);
  const cc = city.countryCode?.trim().toUpperCase();
  if (!cc || codes.has(cc) || isUpdate) return { ok: true };
  if (codes.size >= FREEMIUM_LIMITS.countries) {
    return { ok: false, code: 'countries', limit: FREEMIUM_LIMITS.countries };
  }
  return { ok: true };
}

/** Новый город — лимит числа городов. */
export function checkFreemiumCityCountLimit(
  db: Database,
  user: DbUser,
  cityId: string,
): LimitCheckResult {
  if (!FREEMIUM_LIMITS_ENFORCED) return { ok: true };
  if (isPremium(user)) return { ok: true };
  const exists = db.prepare('SELECT 1 FROM cities WHERE id = ? AND owner_id = ?').get(cityId, user.id);
  if (exists) return { ok: true };
  const count = countUserCities(db, user.id);
  if (count < FREEMIUM_LIMITS.cities) return { ok: true };
  return { ok: false, code: 'cities', limit: FREEMIUM_LIMITS.cities };
}

/** @deprecated use checkFreemiumCountryLimit — kept name for older call sites */
export function checkFreemiumCityLimit(
  db: Database,
  user: DbUser,
  city: City,
  isUpdate: boolean,
): LimitCheckResult {
  if (!isUpdate) {
    const cityCount = checkFreemiumCityCountLimit(db, user, city.id);
    if (!cityCount.ok) return cityCount;
  }
  return checkFreemiumCountryLimit(db, user, city, isUpdate);
}

export function checkFreemiumRouteLimit(
  db: Database,
  user: DbUser,
  routeId: string,
): LimitCheckResult {
  if (!FREEMIUM_LIMITS_ENFORCED) return { ok: true };
  if (isPremium(user)) return { ok: true };
  const count = countUserRoutes(db, user.id);
  const exists = db.prepare('SELECT 1 FROM routes WHERE id = ? AND owner_id = ?').get(routeId, user.id);
  if (exists || count < FREEMIUM_LIMITS.routes) return { ok: true };
  return { ok: false, code: 'routes', limit: FREEMIUM_LIMITS.routes };
}

export function checkFreemiumPlaceLimit(
  db: Database,
  user: DbUser,
  placeId: string,
): LimitCheckResult {
  if (!FREEMIUM_LIMITS_ENFORCED) return { ok: true };
  if (isPremium(user)) return { ok: true };
  const count = countUserPlaces(db, user.id);
  const exists = db.prepare('SELECT 1 FROM places WHERE id = ? AND owner_id = ?').get(placeId, user.id);
  if (exists || count < FREEMIUM_LIMITS.places) return { ok: true };
  return { ok: false, code: 'places', limit: FREEMIUM_LIMITS.places };
}

export function usageForUser(db: Database, userId: string): UserUsage {
  return getUserUsage(db, userId);
}
