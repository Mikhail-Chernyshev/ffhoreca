import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '.env') });
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { deletePlace, deleteRoute, getCatalog, getRoutes, openDatabase, upsertCity, upsertPlace, upsertRoute } from './db';
import type { City, TravelRoute, UserRouteMode } from '../../src/data/types';
import { isValidPlace } from './validatePlace';

const PORT = Number(process.env.PORT ?? 3001);
const DATABASE_PATH = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? 'server/data/catalog.sqlite',
);
const UPLOADS_DIR = path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? 'server/data/uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const ADMIN_TOKEN = (
  process.env.ADMIN_TOKEN ?? process.env.VITE_ADMIN_TOKEN ??
  ''
).trim();

/** Несколько origin через запятую: локалка + прод на GitHub Pages.
 * Для Pages в браузере Origin всегда `https://username.github.io` (без `/repo`). */
function corsOriginOption(): string | string[] {
  const raw = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').trim();
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return 'http://localhost:5173';
  return list.length === 1 ? list[0] : list;
}

const db = openDatabase(DATABASE_PATH);

const app = new Hono();

app.use(
  '/*',
  cors({
    origin: corsOriginOption(),
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Admin-Token'],
  }),
);

const ROUTE_MODES = new Set<UserRouteMode>(['plane', 'train', 'bus', 'boat']);

function isValidCity(x: unknown): x is City {
  if (x == null || typeof x !== 'object') return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.id === 'string' && c.id.trim().length > 0 &&
    typeof c.name === 'string' && c.name.trim().length > 0 &&
    typeof c.countryCode === 'string' && c.countryCode.trim().length > 0 &&
    typeof c.lat === 'number' &&
    typeof c.lng === 'number'
  );
}

function isValidRoute(x: unknown): x is TravelRoute {
  if (x == null || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id.trim()) return false;
  if (!Array.isArray(r.waypoints) || r.waypoints.length < 2) return false;
  for (const w of r.waypoints) {
    if (w == null || typeof w !== 'object') return false;
    const wp = w as Record<string, unknown>;
    if (typeof wp.cityId !== 'string') return false;
    if (typeof wp.name !== 'string') return false;
    if (typeof wp.lat !== 'number' || typeof wp.lng !== 'number') return false;
  }
  if (typeof r.mode !== 'string' || !ROUTE_MODES.has(r.mode as UserRouteMode)) return false;
  return true;
}

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/catalog', (c) => {
  try {
    return c.json(getCatalog(db));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 500);
  }
});

app.post('/api/places', async (c) => {
  if (!ADMIN_TOKEN) {
    return c.json({ error: 'ADMIN_TOKEN не задан на сервере' }, 503);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Некорректный JSON' }, 400);
  }
  if (body == null || typeof body !== 'object') {
    return c.json({ error: 'Ожидается объект' }, 400);
  }
  const rec = body as Record<string, unknown>;
  if (rec.token !== ADMIN_TOKEN) {
    return c.json({ error: 'Неверный token' }, 401);
  }
  if (!isValidPlace(rec.place)) {
    return c.json({ error: 'Некорректное тело place' }, 400);
  }
  try {
    // Если передан город — сохраняем его (чтобы маркер города появился на карте)
    if (isValidCity(rec.city)) {
      upsertCity(db, rec.city);
    }
    upsertPlace(db, rec.place);
    return c.json({ place: rec.place }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 500);
  }
});

app.post('/api/places/delete', async (c) => {
  if (!ADMIN_TOKEN) {
    return c.json({ error: 'ADMIN_TOKEN не задан на сервере' }, 503);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Некорректный JSON' }, 400);
  }
  if (body == null || typeof body !== 'object') {
    return c.json({ error: 'Ожидается объект' }, 400);
  }
  const rec = body as Record<string, unknown>;
  if (rec.token !== ADMIN_TOKEN) {
    return c.json({ error: 'Неверный token' }, 401);
  }
  const id = typeof rec.id === 'string' ? rec.id.trim() : '';
  if (!id) {
    return c.json({ error: 'Нужен непустой id' }, 400);
  }
  try {
    const removed = deletePlace(db, id);
    if (!removed) {
      return c.json({ error: 'Место не найдено' }, 404);
    }
    return c.json({ ok: true, id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 500);
  }
});

// ---- Photo upload ----------------------------------------------------------

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

app.post('/api/photos', async (c) => {
  if (!ADMIN_TOKEN) return c.json({ error: 'ADMIN_TOKEN не задан' }, 503);
  const token = c.req.header('X-Admin-Token') ?? '';
  if (token !== ADMIN_TOKEN) return c.json({ error: 'Неверный token' }, 401);

  let formData: FormData;
  try { formData = await c.req.formData(); } catch { return c.json({ error: 'Ожидается multipart/form-data' }, 400); }

  const urls: string[] = [];
  for (const [, value] of formData.entries()) {
    if (!(value instanceof File)) continue;
    if (!ALLOWED_IMAGE_MIME.has(value.type)) continue;
    if (value.size > MAX_FILE_SIZE) continue;

    const ext = value.type.split('/')[1] ?? 'jpg';
    const filename = `${crypto.randomUUID()}.${ext}`;
    const dest = path.join(UPLOADS_DIR, filename);
    const buffer = Buffer.from(await value.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    urls.push(`/uploads/${filename}`);
  }

  if (urls.length === 0) return c.json({ error: 'Нет подходящих файлов' }, 400);
  return c.json({ urls }, 201);
});

// Отдача загруженных файлов
app.get('/uploads/:filename', (c) => {
  const filename = c.req.param('filename');
  if (!filename || filename.includes('..')) return c.json({ error: 'Not found' }, 404);
  const filepath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filepath)) return c.json({ error: 'Not found' }, 404);
  const data = fs.readFileSync(filepath);
  const ext = path.extname(filename).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : 'image/gif';
  return new Response(data, { headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' } });
});

// ---- Routes ----------------------------------------------------------------

app.get('/api/routes', (c) => {
  try {
    return c.json(getRoutes(db));
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post('/api/routes', async (c) => {
  if (!ADMIN_TOKEN) return c.json({ error: 'ADMIN_TOKEN не задан на сервере' }, 503);
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Некорректный JSON' }, 400); }
  if (body == null || typeof body !== 'object') return c.json({ error: 'Ожидается объект' }, 400);
  const rec = body as Record<string, unknown>;
  if (rec.token !== ADMIN_TOKEN) return c.json({ error: 'Неверный token' }, 401);
  if (!isValidRoute(rec.route)) return c.json({ error: 'Некорректный маршрут' }, 400);
  try {
    upsertRoute(db, rec.route);
    return c.json({ route: rec.route }, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.delete('/api/routes/:id', async (c) => {
  if (!ADMIN_TOKEN) return c.json({ error: 'ADMIN_TOKEN не задан на сервере' }, 503);
  const token = c.req.header('X-Admin-Token') ?? '';
  if (token !== ADMIN_TOKEN) return c.json({ error: 'Неверный token' }, 401);
  const id = c.req.param('id');
  try {
    const removed = deleteRoute(db, id);
    if (!removed) return c.json({ error: 'Маршрут не найден' }, 404);
    return c.json({ ok: true, id });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

console.log(`ffhoreca API http://localhost:${PORT}`);
console.log('  GET  /api/catalog');
console.log('  POST /api/places         { token, place }');
console.log('  POST /api/places/delete  { token, id }');
console.log('  GET  /api/routes');
console.log('  POST /api/routes         { token, route }');
console.log('  DELETE /api/routes/:id   X-Admin-Token header');
console.log('  POST /api/photos         multipart/form-data, X-Admin-Token header');
console.log('  GET  /uploads/:filename');

serve({
  fetch: app.fetch,
  port: PORT,
});
