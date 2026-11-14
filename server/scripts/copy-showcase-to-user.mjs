/**
 * Copy showcase catalog (owner_id = '') onto a personal user map.
 * Usage on Fly:
 *   node /tmp/copy-showcase-to-user.mjs
 *   node /tmp/copy-showcase-to-user.mjs --apply
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = [
  process.env.APP_ROOT,
  '/app',
  path.resolve(scriptDir, '../..'),
  process.cwd(),
].find((candidate) => candidate && fs.existsSync(path.join(candidate, 'node_modules/better-sqlite3')));
if (!appRoot) {
  throw new Error('better-sqlite3 not found; set APP_ROOT to the app directory');
}
const require = createRequire(path.join(appRoot, 'package.json'));
const Database = require('better-sqlite3');

const DB_PATH = process.env.DATABASE_PATH ?? '/data/catalog.sqlite';
const EMAIL = (process.env.TARGET_EMAIL ?? 'newmishach@gmail.com').trim().toLowerCase();
const APPLY = process.argv.includes('--apply');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

function count(table, ownerId) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE owner_id = ?`).get(ownerId).n;
}

function snapshot(ownerId) {
  return {
    cities: count('cities', ownerId),
    places: count('places', ownerId),
    routes: count('routes', ownerId),
  };
}

const showcaseOwner = '';
const user = db.prepare(
  'SELECT id, username, email, transit_countries FROM users WHERE LOWER(email) = ?',
).get(EMAIL);

const showcaseTransitRow = db.prepare(
  "SELECT value FROM app_settings WHERE key = 'showcase_transit_countries'",
).get();

const report = {
  apply: APPLY,
  email: EMAIL,
  user: user
    ? { id: user.id, username: user.username, transit: user.transit_countries }
    : null,
  showcase: snapshot(showcaseOwner),
  showcaseTransit: showcaseTransitRow?.value ?? null,
  personal: user ? snapshot(user.id) : null,
};

if (!user) {
  console.log(JSON.stringify({ ok: false, error: 'user_not_found', ...report }, null, 2));
  process.exit(1);
}

if (!APPLY) {
  console.log(JSON.stringify({ ok: true, dryRun: true, ...report }, null, 2));
  process.exit(0);
}

const copyTable = db.transaction((table) => {
  const rows = db.prepare(`SELECT id, json FROM ${table} WHERE owner_id = ?`).all(showcaseOwner);
  db.prepare(`DELETE FROM ${table} WHERE owner_id = ?`).run(user.id);
  const ins = db.prepare(
    `INSERT INTO ${table} (owner_id, id, json, user_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(owner_id, id) DO UPDATE SET json = excluded.json, user_id = excluded.user_id`,
  );
  for (const row of rows) ins.run(user.id, row.id, row.json, user.id);
  return rows.length;
});

const copied = {
  cities: copyTable('cities'),
  places: copyTable('places'),
  routes: copyTable('routes'),
};

if (showcaseTransitRow?.value != null) {
  db.prepare('UPDATE users SET transit_countries = ? WHERE id = ?').run(
    showcaseTransitRow.value,
    user.id,
  );
}

const after = db.prepare(
  'SELECT username, transit_countries FROM users WHERE id = ?',
).get(user.id);

console.log(
  JSON.stringify(
    {
      ok: true,
      dryRun: false,
      email: EMAIL,
      username: after.username,
      copied,
      personalAfter: snapshot(user.id),
      transit: after.transit_countries,
    },
    null,
    2,
  ),
);
