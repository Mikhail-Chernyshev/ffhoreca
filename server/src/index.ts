import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '.env') });
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { deletePlace, getCatalog, openDatabase, upsertPlace } from './db';
import { isValidPlace } from './validatePlace';

const PORT = Number(process.env.PORT ?? 3001);
const DATABASE_PATH = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? 'server/data/catalog.sqlite',
);
const ADMIN_TOKEN = (
  process.env.ADMIN_TOKEN ?? process.env.VITE_ADMIN_TOKEN ??
  ''
).trim();
const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').trim();

const db = openDatabase(DATABASE_PATH);

const app = new Hono();

app.use(
  '/*',
  cors({
    origin: CORS_ORIGIN,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

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

console.log(`ffhoreca API http://localhost:${PORT}`);
console.log('  GET  /api/catalog');
console.log('  POST /api/places       { token, place }');
console.log('  POST /api/places/delete  { token, id }');

serve({
  fetch: app.fetch,
  port: PORT,
});
