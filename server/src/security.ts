import type { Context, Next } from 'hono';

export const FIELD_LIMITS = {
  id: 120,
  name: 200,
  address: 500,
  summary: 2000,
  story: 20_000,
  photoUrl: 512,
  photosMax: 20,
  waypointsMax: 50,
  waypointName: 200,
  jsonBodyBytes: 256 * 1024,
} as const;

const UPLOAD_PHOTO_RE = /^\/uploads\/[0-9a-f-]{36}\.(?:jpe?g|png|webp|gif)$/i;

/** Только относительные пути загрузок с UUID-именем. */
export function isValidPhotoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > FIELD_LIMITS.photoUrl) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return false;
  return UPLOAD_PHOTO_RE.test(trimmed);
}

export function hasMaxLen(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

export function securityHeadersMiddleware() {
  return async (c: Context, next: Next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    c.header(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
  };
}

export function jsonBodyLimitMiddleware(maxBytes = FIELD_LIMITS.jsonBodyBytes) {
  return async (c: Context, next: Next) => {
    const method = c.req.method;
    if (method !== 'POST' && method !== 'PATCH') return next();
    const ct = c.req.header('content-type') ?? '';
    if (!ct.includes('application/json')) return next();
    const len = Number(c.req.header('content-length') ?? 0);
    if (len > maxBytes) {
      return c.json({ error: 'Слишком большой запрос' }, 413);
    }
    await next();
  };
}

export async function readJsonBody(
  c: Context,
  maxBytes = FIELD_LIMITS.jsonBodyBytes,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    return { ok: false, response: c.json({ error: 'Слишком большой запрос' }, 413) };
  }
  if (buf.byteLength === 0) {
    return { ok: false, response: c.json({ error: 'Пустое тело запроса' }, 400) };
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return { ok: false, response: c.json({ error: 'Некорректный JSON' }, 400) };
  }
}
