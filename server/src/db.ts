import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Catalog, City, Place, TravelRoute } from '../../src/data/types';
import type { MapVisibility, UserSubscription } from '../../src/data/subscription';
import { normalizePhotoUrl } from './security';

export interface DbUser {
  id: string;
  google_id: string;
  email: string | null;
  name: string;
  username: string | null;
  avatar: string | null;
  subscription: UserSubscription;
  map_visibility: MapVisibility;
  created_at: number;
}

export interface UserUsage {
  countries: number;
  routes: number;
  places: number;
}

function normalizePlaceRow(raw: unknown): Place {
  const p = raw as Place;
  let photos: string[] | null = null;
  if (Array.isArray(p.photos) && p.photos.length > 0) {
    const urls = p.photos
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => normalizePhotoUrl(x));
    photos = urls.length > 0 ? urls : null;
  }
  return { ...p, photos };
}

export function openDatabase(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      avatar TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS favorites (
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (owner_id, target_id)
    );
  `);
  // Add user_id column to existing tables if missing (non-destructive migration)
  for (const table of ['cities', 'places', 'routes'] as const) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`);
    } catch (e) {
      if (!(e instanceof Error && e.message.includes('duplicate column name'))) throw e;
    }
  }
  for (const col of [
    "subscription TEXT NOT NULL DEFAULT 'freemium'",
    "map_visibility TEXT NOT NULL DEFAULT 'public'",
  ]) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${col}`);
    } catch (e) {
      if (!(e instanceof Error && e.message.includes('duplicate column name'))) throw e;
    }
  }
  return db;
}

export function getCatalog(db: Database.Database): Catalog {
  const cityRows = db.prepare('SELECT json FROM cities ORDER BY id').all() as {
    json: string;
  }[];
  const placeRows = db.prepare('SELECT json FROM places ORDER BY id').all() as {
    json: string;
  }[];
  return {
    cities: cityRows.map((r) => JSON.parse(r.json) as City),
    places: placeRows.map((r) => normalizePlaceRow(JSON.parse(r.json))),
  };
}

export function replaceCatalog(db: Database.Database, catalog: Catalog): void {
  const insCity = db.prepare(
    'INSERT INTO cities (id, json) VALUES (@id, @json)',
  );
  const insPlace = db.prepare(
    'INSERT INTO places (id, json) VALUES (@id, @json)',
  );
  const tx = db.transaction(() => {
    db.exec('DELETE FROM cities');
    db.exec('DELETE FROM places');
    for (const c of catalog.cities) {
      insCity.run({ id: c.id, json: JSON.stringify(c) });
    }
    for (const p of catalog.places) {
      insPlace.run({ id: p.id, json: JSON.stringify(p) });
    }
  });
  tx();
}

export function deletePlace(db: Database.Database, id: string): boolean {
  const r = db.prepare('DELETE FROM places WHERE id = ?').run(id);
  return r.changes > 0;
}

export function upsertPlace(db: Database.Database, place: Place): void {
  db.prepare(
    'INSERT INTO places (id, json) VALUES (@id, @json) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
  ).run({ id: place.id, json: JSON.stringify(place) });
}

export function deleteCity(db: Database.Database, id: string): boolean {
  const r = db.prepare('DELETE FROM cities WHERE id = ?').run(id);
  return r.changes > 0;
}

export function countPlacesInCity(db: Database.Database, cityId: string): number {
  const rows = db.prepare('SELECT json FROM places').all() as { json: string }[];
  let n = 0;
  for (const row of rows) {
    const p = JSON.parse(row.json) as Place;
    if (p.cityId === cityId) n++;
  }
  return n;
}

export function upsertCity(db: Database.Database, city: City): void {
  db.prepare(
    'INSERT INTO cities (id, json) VALUES (@id, @json) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
  ).run({ id: city.id, json: JSON.stringify(city) });
}

export function getRoutes(db: Database.Database): TravelRoute[] {
  const rows = db.prepare('SELECT json FROM routes ORDER BY id').all() as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as TravelRoute);
}

export function upsertRoute(db: Database.Database, route: TravelRoute): void {
  db.prepare(
    'INSERT INTO routes (id, json) VALUES (@id, @json) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
  ).run({ id: route.id, json: JSON.stringify(route) });
}

export function deleteRoute(db: Database.Database, id: string): boolean {
  const r = db.prepare('DELETE FROM routes WHERE id = ?').run(id);
  return r.changes > 0;
}

// ---- Users -----------------------------------------------------------------

export function findUserByGoogleId(db: Database.Database, googleId: string): DbUser | null {
  return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) as DbUser | null;
}

export function findUserById(db: Database.Database, id: string): DbUser | null {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | null;
}

export function findUserByUsername(db: Database.Database, username: string): DbUser | null {
  return db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username) as DbUser | null;
}

export function createUser(db: Database.Database, user: Omit<DbUser, 'created_at'>): DbUser {
  db.prepare(
    `INSERT INTO users (id, google_id, email, name, username, avatar, subscription, map_visibility)
     VALUES (@id, @google_id, @email, @name, @username, @avatar, @subscription, @map_visibility)`,
  ).run({
    ...user,
    subscription: user.subscription ?? 'freemium',
    map_visibility: user.map_visibility ?? 'public',
  });
  return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as DbUser;
}

export function updateUser(
  db: Database.Database,
  id: string,
  updates: Partial<Pick<DbUser, 'username' | 'name' | 'avatar' | 'subscription' | 'map_visibility'>>,
): DbUser | null {
  const fields: string[] = [];
  const values: Record<string, unknown> = { id };
  if (updates.username !== undefined) { fields.push('username = @username'); values.username = updates.username; }
  if (updates.name !== undefined) { fields.push('name = @name'); values.name = updates.name; }
  if (updates.avatar !== undefined) { fields.push('avatar = @avatar'); values.avatar = updates.avatar; }
  if (updates.subscription !== undefined) { fields.push('subscription = @subscription'); values.subscription = updates.subscription; }
  if (updates.map_visibility !== undefined) { fields.push('map_visibility = @map_visibility'); values.map_visibility = updates.map_visibility; }
  if (fields.length === 0) return findUserById(db, id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = @id`).run(values);
  return findUserById(db, id);
}

export function isUsernameAvailable(db: Database.Database, username: string): boolean {
  return !db.prepare('SELECT 1 FROM users WHERE LOWER(username) = LOWER(?)').get(username);
}

export function searchUsers(db: Database.Database, query: string, limit = 10): DbUser[] {
  const q = `%${query.toLowerCase()}%`;
  return db.prepare(
    'SELECT * FROM users WHERE username IS NOT NULL AND (LOWER(username) LIKE ? OR LOWER(name) LIKE ?) LIMIT ?',
  ).all(q, q, limit) as DbUser[];
}

// ---- User catalog ----------------------------------------------------------

export function getUserCatalog(db: Database.Database, userId: string): Catalog {
  const cityRows = db.prepare('SELECT json FROM cities WHERE user_id = ? ORDER BY id').all(userId) as { json: string }[];
  const placeRows = db.prepare('SELECT json FROM places WHERE user_id = ? ORDER BY id').all(userId) as { json: string }[];
  return {
    cities: cityRows.map((r) => JSON.parse(r.json) as City),
    places: placeRows.map((r) => normalizePlaceRow(JSON.parse(r.json))),
  };
}

export function getUserRoutes(db: Database.Database, userId: string): TravelRoute[] {
  const rows = db.prepare('SELECT json FROM routes WHERE user_id = ? ORDER BY id').all(userId) as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as TravelRoute);
}

export function upsertUserCity(db: Database.Database, userId: string, city: City): void {
  db.prepare(
    'INSERT INTO cities (id, json, user_id) VALUES (@id, @json, @user_id) ON CONFLICT(id) DO UPDATE SET json = excluded.json, user_id = excluded.user_id',
  ).run({ id: city.id, json: JSON.stringify(city), user_id: userId });
}

export function deleteUserCity(db: Database.Database, userId: string, cityId: string): boolean {
  const r = db.prepare('DELETE FROM cities WHERE id = ? AND user_id = ?').run(cityId, userId);
  return r.changes > 0;
}

export function countUserPlacesInCity(db: Database.Database, userId: string, cityId: string): number {
  const rows = db.prepare('SELECT json FROM places WHERE user_id = ?').all(userId) as { json: string }[];
  let n = 0;
  for (const row of rows) {
    const p = JSON.parse(row.json) as Place;
    if (p.cityId === cityId) n++;
  }
  return n;
}

export function upsertUserPlace(db: Database.Database, userId: string, place: Place): void {
  db.prepare(
    'INSERT INTO places (id, json, user_id) VALUES (@id, @json, @user_id) ON CONFLICT(id) DO UPDATE SET json = excluded.json, user_id = excluded.user_id',
  ).run({ id: place.id, json: JSON.stringify(place), user_id: userId });
}

export function deleteUserPlace(db: Database.Database, userId: string, placeId: string): boolean {
  const r = db.prepare('DELETE FROM places WHERE id = ? AND user_id = ?').run(placeId, userId);
  return r.changes > 0;
}

export function upsertUserRoute(db: Database.Database, userId: string, route: TravelRoute): void {
  db.prepare(
    'INSERT INTO routes (id, json, user_id) VALUES (@id, @json, @user_id) ON CONFLICT(id) DO UPDATE SET json = excluded.json, user_id = excluded.user_id',
  ).run({ id: route.id, json: JSON.stringify(route), user_id: userId });
}

export function deleteUserRoute(db: Database.Database, userId: string, routeId: string): boolean {
  const r = db.prepare('DELETE FROM routes WHERE id = ? AND user_id = ?').run(routeId, userId);
  return r.changes > 0;
}

export function countUserPlaces(db: Database.Database, userId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM places WHERE user_id = ?').get(userId) as { n: number };
  return row.n;
}

export function countUserRoutes(db: Database.Database, userId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM routes WHERE user_id = ?').get(userId) as { n: number };
  return row.n;
}

export function countUserCities(db: Database.Database, userId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM cities WHERE user_id = ?').get(userId) as { n: number };
  return row.n;
}

/** Уникальные страны по городам пользователя */
export function countUserCountries(db: Database.Database, userId: string): number {
  const rows = db.prepare('SELECT json FROM cities WHERE user_id = ?').all(userId) as { json: string }[];
  const codes = new Set<string>();
  for (const row of rows) {
    const city = JSON.parse(row.json) as City;
    if (city.countryCode?.trim()) codes.add(city.countryCode.toUpperCase());
  }
  return codes.size;
}

export function getUserUsage(db: Database.Database, userId: string): UserUsage {
  return {
    countries: countUserCountries(db, userId),
    routes: countUserRoutes(db, userId),
    places: countUserPlaces(db, userId),
  };
}

export function userCountryCodes(db: Database.Database, userId: string): Set<string> {
  const rows = db.prepare('SELECT json FROM cities WHERE user_id = ?').all(userId) as { json: string }[];
  const codes = new Set<string>();
  for (const row of rows) {
    const city = JSON.parse(row.json) as City;
    if (city.countryCode?.trim()) codes.add(city.countryCode.toUpperCase());
  }
  return codes;
}

// ---- Favorites -------------------------------------------------------------

export function addFavorite(db: Database.Database, ownerId: string, targetId: string): void {
  db.prepare('INSERT OR IGNORE INTO favorites (owner_id, target_id) VALUES (?, ?)').run(ownerId, targetId);
}

export function removeFavorite(db: Database.Database, ownerId: string, targetId: string): void {
  db.prepare('DELETE FROM favorites WHERE owner_id = ? AND target_id = ?').run(ownerId, targetId);
}

export function getFavorites(db: Database.Database, ownerId: string): DbUser[] {
  return db.prepare(
    'SELECT u.* FROM users u JOIN favorites f ON f.target_id = u.id WHERE f.owner_id = ? ORDER BY f.created_at DESC',
  ).all(ownerId) as DbUser[];
}

export function isFavorite(db: Database.Database, ownerId: string, targetId: string): boolean {
  return !!db.prepare('SELECT 1 FROM favorites WHERE owner_id = ? AND target_id = ?').get(ownerId, targetId);
}
