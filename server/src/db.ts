import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Catalog, City, Place, TravelRoute } from '../../src/data/types';

function normalizePlaceRow(raw: unknown): Place {
  const p = raw as Place;
  let photos: string[] | null = null;
  if (Array.isArray(p.photos) && p.photos.length > 0) {
    const urls = p.photos.filter(
      (x): x is string => typeof x === 'string' && x.trim().length > 0,
    );
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
  `);
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
