import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Catalog, City, Place } from '../../src/data/types';

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
    places: placeRows.map((r) => JSON.parse(r.json) as Place),
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

export function upsertPlace(db: Database.Database, place: Place): void {
  db.prepare(
    'INSERT INTO places (id, json) VALUES (@id, @json) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
  ).run({ id: place.id, json: JSON.stringify(place) });
}
