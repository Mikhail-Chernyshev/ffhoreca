import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '.env') });
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context, Next } from 'hono';
import {
  deletePlace, deleteRoute, deleteCity, countPlacesInCity,
  getCatalog, getRoutes, openDatabase,
  upsertCity, upsertPlace, upsertRoute,
  findUserByGoogleId, findUserById, findUserByUsername,
  createUser, updateUser, isUsernameAvailable, searchUsers,
  getUserCatalog, getUserRoutes,
  upsertUserCity, deleteUserCity, countUserPlacesInCity,
  upsertUserPlace, deleteUserPlace,
  upsertUserRoute, deleteUserRoute,
  addFavorite, removeFavorite, getFavorites, isFavorite,
  getUserUsage,
  type DbUser,
} from './db';
import type { City, TravelRoute } from '../../src/data/types';
import type { MapVisibility } from '../../src/data/subscription';
import {
  canViewUserMap,
  checkFreemiumCityLimit,
  checkFreemiumPlaceLimit,
  checkFreemiumRouteLimit,
  normalizeMapVisibility,
  normalizeSubscription,
} from './subscription';
import { isValidPlace } from './validatePlace';
import { isValidCity, isValidRoute } from './validateInput';
import {
  assertJwtSecretConfigured,
  clearSessionCookieHeader,
  consumeOAuthState,
  createOAuthState,
  createAuthExchangeCode,
  consumeAuthExchangeCode,
  exchangeGoogleCode,
  getGoogleAuthUrl,
  sessionCookieHeader,
  signJWT,
  verifyJWT,
} from './auth';
import { sendFeedbackEmail } from './feedbackMail';
import { isValidReportReason, sendPlaceReportEmail } from './reportMail';
import { rateLimitOrResponse } from './rateLimit';
import {
  jsonBodyLimitMiddleware,
  readJsonBody,
  securityHeadersMiddleware,
} from './security';
import { v4 as uuidv4 } from 'uuid';

assertJwtSecretConfigured();

const PORT = Number(process.env.PORT ?? 3001);
const DATABASE_PATH = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? 'server/data/catalog.sqlite',
);
const UPLOADS_DIR = path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? 'server/data/uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:${PORT}/api/auth/google/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/i;

function extractAuthToken(c: Context): string | null {
  const cookie = c.req.header('Cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)ffhoreca_session=([^;]+)/);
  if (match) {
    try {
      const token = decodeURIComponent(match[1]).trim();
      if (token) return token;
    } catch {
      const token = match[1].trim();
      if (token) return token;
    }
  }
  const header = c.req.header('Authorization') ?? '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  return null;
}

async function parseJsonObject(
  c: Context,
): Promise<Record<string, unknown> | Response> {
  const parsed = await readJsonBody(c);
  if (!parsed.ok) return parsed.response;
  if (parsed.body == null || typeof parsed.body !== 'object' || Array.isArray(parsed.body)) {
    return c.json({ error: 'Ожидается объект' }, 400);
  }
  return parsed.body as Record<string, unknown>;
}

/** Витрину может редактировать только залогиненный пользователь с ADMIN_EMAIL. */
async function requireShowcaseAdmin(c: Context): Promise<DbUser | null> {
  if (!ADMIN_EMAIL) return null;
  const token = extractAuthToken(c);
  if (!token) return null;
  const payload = await verifyJWT(token);
  if (!payload) return null;
  const user = findUserById(db, payload.sub);
  if (!user || (user.email ?? '').toLowerCase() !== ADMIN_EMAIL) return null;
  return user;
}

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
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.use('/*', securityHeadersMiddleware());
app.use('/api/*', jsonBodyLimitMiddleware());

// ---- Auth middleware -------------------------------------------------------

type HonoEnv = { Variables: { user: DbUser } };
const authApp = new Hono<HonoEnv>();

async function requireAuth(c: Context<HonoEnv>, next: Next) {
  const token = extractAuthToken(c);
  if (!token) return c.json({ error: 'Требуется авторизация' }, 401);
  const payload = await verifyJWT(token);
  if (!payload) return c.json({ error: 'Недействительный токен' }, 401);
  const user = findUserById(db, payload.sub);
  if (!user) return c.json({ error: 'Пользователь не найден' }, 401);
  c.set('user', user);
  await next();
}

function serializePublicUser(u: DbUser) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    subscription: normalizeSubscription(u.subscription),
    map_visibility: normalizeMapVisibility(u.map_visibility),
  };
}

function serializeAuthUser(u: DbUser) {
  return {
    ...serializePublicUser(u),
    email: u.email,
  };
}

async function optionalAuthUser(c: Context): Promise<DbUser | null> {
  const token = extractAuthToken(c);
  if (!token) return null;
  const payload = await verifyJWT(token);
  if (!payload) return null;
  return findUserById(db, payload.sub);
}

function limitErrorMessage(code: 'countries' | 'routes' | 'places', limit: number): string {
  if (code === 'countries') return `Лимит Freemium: не более ${limit} стран. Перейдите на Premium.`;
  if (code === 'routes') return `Лимит Freemium: не более ${limit} маршрутов. Перейдите на Premium.`;
  return `Лимит Freemium: не более ${limit} мест. Перейдите на Premium.`;
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

app.post('/api/cities', async (c) => {
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  if (!(await requireShowcaseAdmin(c))) return c.json({ error: 'Недостаточно прав' }, 403);
  if (!isValidCity(rec.city)) return c.json({ error: 'Некорректное тело city' }, 400);
  try {
    upsertCity(db, rec.city);
    return c.json({ city: rec.city }, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.delete('/api/cities/:id', async (c) => {
  if (!(await requireShowcaseAdmin(c))) return c.json({ error: 'Недостаточно прав' }, 403);
  const id = c.req.param('id')?.trim() ?? '';
  if (!id) return c.json({ error: 'Нужен id города' }, 400);
  try {
    const placesCount = countPlacesInCity(db, id);
    if (placesCount > 0) {
      return c.json(
        { error: `В городе ${placesCount} мест(а). Сначала удалите их.` },
        409,
      );
    }
    const removed = deleteCity(db, id);
    if (!removed) return c.json({ error: 'Город не найден' }, 404);
    return c.json({ ok: true, id });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post('/api/places', async (c) => {
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  if (!(await requireShowcaseAdmin(c))) return c.json({ error: 'Недостаточно прав' }, 403);
  if (!isValidPlace(rec.place)) return c.json({ error: 'Некорректное тело place' }, 400);
  try {
    if (isValidCity(rec.city)) upsertCity(db, rec.city);
    upsertPlace(db, rec.place);
    return c.json({ place: rec.place }, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post('/api/places/delete', async (c) => {
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  if (!(await requireShowcaseAdmin(c))) return c.json({ error: 'Недостаточно прав' }, 403);
  const id = typeof rec.id === 'string' ? rec.id.trim() : '';
  if (!id) return c.json({ error: 'Нужен непустой id' }, 400);
  try {
    const removed = deletePlace(db, id);
    if (!removed) return c.json({ error: 'Место не найдено' }, 404);
    return c.json({ ok: true, id });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ---- Photo upload ----------------------------------------------------------

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

app.post('/api/photos', async (c) => {
  if (!(await requireShowcaseAdmin(c))) return c.json({ error: 'Недостаточно прав' }, 403);

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
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  if (!(await requireShowcaseAdmin(c))) return c.json({ error: 'Недостаточно прав' }, 403);
  if (!isValidRoute(rec.route)) return c.json({ error: 'Некорректный маршрут' }, 400);
  try {
    upsertRoute(db, rec.route);
    return c.json({ route: rec.route }, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.delete('/api/routes/:id', async (c) => {
  if (!(await requireShowcaseAdmin(c))) return c.json({ error: 'Недостаточно прав' }, 403);
  const id = c.req.param('id');
  try {
    const removed = deleteRoute(db, id);
    if (!removed) return c.json({ error: 'Маршрут не найден' }, 404);
    return c.json({ ok: true, id });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ---- Google OAuth ----------------------------------------------------------

app.get('/api/auth/google', (c) => {
  if (!GOOGLE_CLIENT_ID) return c.json({ error: 'Google OAuth не настроен' }, 503);
  const state = createOAuthState();
  return c.redirect(getGoogleAuthUrl(GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, state));
});

app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code') ?? '';
  const state = c.req.query('state') ?? '';
  const error = c.req.query('error');
  if (error || !code) {
    return c.redirect(`${FRONTEND_URL}?auth_error=${encodeURIComponent(error ?? 'no_code')}`);
  }
  if (!state || !consumeOAuthState(state)) {
    return c.redirect(`${FRONTEND_URL}?auth_error=invalid_state`);
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return c.redirect(`${FRONTEND_URL}?auth_error=not_configured`);
  }

  try {
    const gUser = await exchangeGoogleCode(code, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    if (!gUser) return c.redirect(`${FRONTEND_URL}?auth_error=exchange_failed`);

    let user = findUserByGoogleId(db, gUser.sub);
    if (!user) {
      user = createUser(db, {
        id: uuidv4(),
        google_id: gUser.sub,
        email: gUser.email ?? null,
        name: gUser.name,
        username: null,
        avatar: gUser.picture ?? null,
        subscription: 'freemium',
        map_visibility: 'public',
      });
    } else {
      // Обновляем аватар/имя если изменились
      user = updateUser(db, user.id, { name: gUser.name, avatar: gUser.picture ?? null }) ?? user;
    }

    const jwt = await signJWT(user.id);
    const exchangeCode = createAuthExchangeCode(jwt);
    c.header('Set-Cookie', sessionCookieHeader(jwt));
    return c.redirect(`${FRONTEND_URL}?auth_code=${encodeURIComponent(exchangeCode)}`);
  } catch (e) {
    console.error('OAuth callback error:', e);
    return c.redirect(`${FRONTEND_URL}?auth_error=server_error`);
  }
});

app.post('/api/auth/logout', (c) => {
  c.header('Set-Cookie', clearSessionCookieHeader());
  return c.json({ ok: true });
});

app.post('/api/auth/exchange', async (c) => {
  const limited = rateLimitOrResponse(c, 'auth-exchange', 20, 60_000);
  if (limited) return limited;

  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  const code = typeof rec.code === 'string' ? rec.code.trim() : '';
  if (!code) return c.json({ error: 'Нужен code' }, 400);

  const jwt = consumeAuthExchangeCode(code);
  if (!jwt) return c.json({ error: 'Недействительный или просроченный code' }, 400);

  c.header('Set-Cookie', sessionCookieHeader(jwt));
  return c.json({ ok: true, token: jwt });
});

app.get('/api/auth/me', requireAuth, (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  return c.json({
    user: serializeAuthUser(user),
    usage: getUserUsage(db, user.id),
  });
});

app.patch('/api/auth/settings', requireAuth, async (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  const updates: Partial<Pick<DbUser, 'map_visibility'>> = {};
  if (rec.map_visibility !== undefined) {
    const v = rec.map_visibility;
    if (v !== 'public' && v !== 'subscribers') {
      return c.json({ error: 'map_visibility: public или subscribers' }, 400);
    }
    updates.map_visibility = v as MapVisibility;
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'Нет полей для обновления' }, 400);
  }
  const updated = updateUser(db, user.id, updates);
  return c.json({
    user: serializeAuthUser(updated!),
    usage: getUserUsage(db, user.id),
  });
});

app.post('/api/auth/username', requireAuth, async (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  const username = typeof rec.username === 'string'
    ? rec.username.trim().toLowerCase()
    : '';
  if (!USERNAME_RE.test(username)) {
    return c.json({ error: 'Логин: 3-30 символов, только латинские буквы, цифры, _ и -' }, 400);
  }
  if (!isUsernameAvailable(db, username) && user.username?.toLowerCase() !== username) {
    return c.json({ error: 'Этот логин уже занят' }, 409);
  }
  const updated = updateUser(db, user.id, { username });
  return c.json({ user: serializeAuthUser(updated!) });
});

// ---- Public user profiles --------------------------------------------------

app.get('/api/users/search', (c) => {
  const limited = rateLimitOrResponse(c, 'users-search', 40, 60_000);
  if (limited) return limited;
  const q = (c.req.query('q') ?? '').trim();
  if (q.length < 2) return c.json({ users: [] });
  const users = searchUsers(db, q, 10);
  return c.json({ users: users.map(serializePublicUser) });
});

app.get('/api/users/:username', async (c) => {
  const username = c.req.param('username');
  const user = findUserByUsername(db, username);
  if (!user) return c.json({ error: 'Пользователь не найден' }, 404);
  const viewer = await optionalAuthUser(c);
  const canView = canViewUserMap(viewer, user);
  return c.json({
    user: serializePublicUser(user),
    map_access: canView ? 'full' : 'restricted',
    required_subscription: normalizeSubscription(user.subscription),
  });
});

app.get('/api/users/:username/catalog', async (c) => {
  const username = c.req.param('username');
  const user = findUserByUsername(db, username);
  if (!user) return c.json({ error: 'Пользователь не найден' }, 404);
  const viewer = await optionalAuthUser(c);
  if (!canViewUserMap(viewer, user)) {
    return c.json({ error: 'Карта доступна только подписчикам с таким же тарифом', restricted: true }, 403);
  }
  return c.json(getUserCatalog(db, user.id));
});

app.get('/api/users/:username/routes', async (c) => {
  const username = c.req.param('username');
  const user = findUserByUsername(db, username);
  if (!user) return c.json({ error: 'Пользователь не найден' }, 404);
  const viewer = await optionalAuthUser(c);
  if (!canViewUserMap(viewer, user)) {
    return c.json({ error: 'Карта доступна только подписчикам с таким же тарифом', restricted: true }, 403);
  }
  return c.json(getUserRoutes(db, user.id));
});

// ---- User CRUD (own map) ---------------------------------------------------

app.post('/api/user/cities', requireAuth, async (c) => {
  const limited = rateLimitOrResponse(c, 'user-write', 90, 60_000);
  if (limited) return limited;
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  const city = rec.city;
  if (!isValidCity(city)) return c.json({ error: 'Некорректный город' }, 400);
  const cityObj = city as City;
  const exists = db.prepare('SELECT 1 FROM cities WHERE id = ? AND user_id = ?').get(cityObj.id, user.id);
  const limit = checkFreemiumCityLimit(db, user, cityObj, Boolean(exists));
  if (!limit.ok) return c.json({ error: limitErrorMessage(limit.code, limit.limit), code: limit.code }, 403);
  try {
    upsertUserCity(db, user.id, cityObj);
    return c.json({ city: cityObj }, 201);
  } catch (e) { return c.json({ error: e instanceof Error ? e.message : String(e) }, 500); }
});

app.delete('/api/user/cities/:id', requireAuth, (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const id = c.req.param('id');
  const placesCount = countUserPlacesInCity(db, user.id, id);
  if (placesCount > 0) {
    return c.json({ error: `В городе ${placesCount} мест(а). Сначала удалите их.` }, 409);
  }
  const removed = deleteUserCity(db, user.id, id);
  if (!removed) return c.json({ error: 'Город не найден' }, 404);
  return c.json({ ok: true, id });
});

app.post('/api/user/places', requireAuth, async (c) => {
  const limited = rateLimitOrResponse(c, 'user-write', 90, 60_000);
  if (limited) return limited;
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  if (!isValidPlace(rec.place)) return c.json({ error: 'Некорректное место' }, 400);
  const place = rec.place as { id: string };
  const limit = checkFreemiumPlaceLimit(db, user, place.id);
  if (!limit.ok) return c.json({ error: limitErrorMessage(limit.code, limit.limit), code: limit.code }, 403);
  try {
    if (isValidCity(rec.city)) upsertUserCity(db, user.id, rec.city);
    upsertUserPlace(db, user.id, rec.place);
    return c.json({ place: rec.place }, 201);
  } catch (e) { return c.json({ error: e instanceof Error ? e.message : String(e) }, 500); }
});

app.post('/api/user/places/delete', requireAuth, async (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  const id = typeof rec.id === 'string' ? rec.id.trim() : '';
  if (!id) return c.json({ error: 'Нужен id' }, 400);
  const removed = deleteUserPlace(db, user.id, id);
  if (!removed) return c.json({ error: 'Место не найдено' }, 404);
  return c.json({ ok: true, id });
});

app.post('/api/user/routes', requireAuth, async (c) => {
  const limited = rateLimitOrResponse(c, 'user-write', 90, 60_000);
  if (limited) return limited;
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  const route = rec.route;
  if (!isValidRoute(route)) return c.json({ error: 'Некорректный маршрут' }, 400);
  const routeObj = route as TravelRoute;
  const limit = checkFreemiumRouteLimit(db, user, routeObj.id);
  if (!limit.ok) return c.json({ error: limitErrorMessage(limit.code, limit.limit), code: limit.code }, 403);
  try {
    upsertUserRoute(db, user.id, routeObj);
    return c.json({ route: routeObj }, 201);
  } catch (e) { return c.json({ error: e instanceof Error ? e.message : String(e) }, 500); }
});

app.delete('/api/user/routes/:id', requireAuth, (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const id = c.req.param('id');
  const removed = deleteUserRoute(db, user.id, id);
  if (!removed) return c.json({ error: 'Маршрут не найден' }, 404);
  return c.json({ ok: true, id });
});

app.post('/api/user/photos', requireAuth, async (c) => {
  const limited = rateLimitOrResponse(c, 'user-upload', 30, 600_000);
  if (limited) return limited;
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
    fs.writeFileSync(dest, Buffer.from(await value.arrayBuffer()));
    urls.push(`/uploads/${filename}`);
  }
  if (urls.length === 0) return c.json({ error: 'Нет подходящих файлов' }, 400);
  return c.json({ urls }, 201);
});

// ---- Favorites -------------------------------------------------------------

app.get('/api/user/favorites', requireAuth, (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const favs = getFavorites(db, user.id);
  return c.json({ favorites: favs.map(serializePublicUser) });
});

app.post('/api/user/favorites', requireAuth, async (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  let target: DbUser | null = null;
  if (typeof rec.targetId === 'string') {
    target = findUserById(db, rec.targetId);
  } else if (typeof rec.targetUsername === 'string') {
    target = findUserByUsername(db, rec.targetUsername);
  }
  if (!target) return c.json({ error: 'Пользователь не найден' }, 404);
  if (target.id === user.id) return c.json({ error: 'Нельзя добавить себя' }, 400);
  addFavorite(db, user.id, target.id);
  return c.json({ ok: true, target: serializePublicUser(target) }, 201);
});

app.delete('/api/user/favorites/:targetId', requireAuth, (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const targetId = c.req.param('targetId');
  removeFavorite(db, user.id, targetId);
  return c.json({ ok: true });
});

app.get('/api/user/favorites/:targetId/check', requireAuth, (c) => {
  const user = (c as unknown as Context<HonoEnv>).get('user');
  const targetId = c.req.param('targetId');
  return c.json({ isFavorite: isFavorite(db, user.id, targetId) });
});

app.post('/api/feedback', async (c) => {
  const limited = rateLimitOrResponse(c, 'feedback', 5, 60_000);
  if (limited) return limited;

  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;
  const email = typeof rec.email === 'string' ? rec.email.trim() : '';
  const message = typeof rec.message === 'string' ? rec.message.trim() : '';
  const name = typeof rec.name === 'string' ? rec.name.trim() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Укажите корректный email' }, 400);
  }
  if (message.length < 10) {
    return c.json({ error: 'Сообщение слишком короткое' }, 400);
  }
  if (message.length > 5000) {
    return c.json({ error: 'Сообщение слишком длинное' }, 400);
  }
  if (name.length > 100) {
    return c.json({ error: 'Имя слишком длинное' }, 400);
  }

  const viewer = await optionalAuthUser(c);
  try {
    await sendFeedbackEmail({
      fromEmail: email,
      fromName: name || undefined,
      message,
      userHint: feedbackUserHint(viewer),
    });
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'SMTP_NOT_CONFIGURED') {
      return c.json({ error: 'Отправка писем временно недоступна' }, 503);
    }
    console.error('Feedback email error:', e);
    return c.json({ error: 'Не удалось отправить сообщение' }, 500);
  }
});

app.post('/api/report', async (c) => {
  const limited = rateLimitOrResponse(c, 'report', 5, 60_000);
  if (limited) return limited;

  const rec = await parseJsonObject(c);
  if (rec instanceof Response) return rec;

  const placeId = typeof rec.placeId === 'string' ? rec.placeId.trim() : '';
  const placeName = typeof rec.placeName === 'string' ? rec.placeName.trim() : '';
  const ownerUsername = typeof rec.ownerUsername === 'string' ? rec.ownerUsername.trim().toLowerCase() : '';
  const reason = rec.reason;
  const message = typeof rec.message === 'string' ? rec.message.trim() : '';
  const name = typeof rec.name === 'string' ? rec.name.trim() : '';
  let email = typeof rec.email === 'string' ? rec.email.trim() : '';

  if (!placeId || !placeName) {
    return c.json({ error: 'Укажите место' }, 400);
  }
  if (!ownerUsername || !USERNAME_RE.test(ownerUsername)) {
    return c.json({ error: 'Некорректный username владельца' }, 400);
  }
  if (!isValidReportReason(reason)) {
    return c.json({ error: 'Укажите причину жалобы' }, 400);
  }
  if (message.length > 2000) {
    return c.json({ error: 'Комментарий слишком длинный' }, 400);
  }
  if (reason === 'other' && message.length < 10) {
    return c.json({ error: 'Для причины «Другое» нужен комментарий (не короче 10 символов)' }, 400);
  }
  if (name.length > 100) {
    return c.json({ error: 'Имя слишком длинное' }, 400);
  }

  const viewer = await optionalAuthUser(c);
  if (!email && viewer?.email) email = viewer.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Укажите корректный email' }, 400);
  }

  const owner = findUserByUsername(db, ownerUsername);
  if (!owner) {
    return c.json({ error: 'Карта не найдена' }, 404);
  }

  const mapUrl = `${FRONTEND_URL.replace(/\/+$/, '')}/${ownerUsername}`;

  try {
    await sendPlaceReportEmail({
      placeId,
      placeName,
      ownerUsername,
      mapUrl,
      reason,
      message: message || undefined,
      reporterEmail: email,
      reporterName: name || undefined,
      userHint: feedbackUserHint(viewer),
    });
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'SMTP_NOT_CONFIGURED') {
      return c.json({ error: 'Отправка писем временно недоступна' }, 503);
    }
    console.error('Report email error:', e);
    return c.json({ error: 'Не удалось отправить жалобу' }, 500);
  }
});

function feedbackUserHint(viewer: DbUser | null): string | undefined {
  if (!viewer) return undefined;
  if (viewer.username) return `@${viewer.username} (${viewer.email ?? viewer.name})`;
  return viewer.email ?? viewer.name;
}

console.log(`ffhoreca API http://localhost:${PORT}`);
console.log('  GET  /api/catalog');
console.log('  POST /api/cities         { token, city }');
console.log('  DELETE /api/cities/:id   X-Admin-Token header');
console.log('  POST /api/places         { token, place }');
console.log('  POST /api/places/delete  { token, id }');
console.log('  GET  /api/routes');
console.log('  POST /api/routes         { token, route }');
console.log('  DELETE /api/routes/:id   X-Admin-Token header');
console.log('  POST /api/photos         multipart/form-data, X-Admin-Token header');
console.log('  POST /api/feedback');
console.log('  POST /api/report');
console.log('  GET  /uploads/:filename');

serve({
  fetch: app.fetch,
  port: PORT,
});
