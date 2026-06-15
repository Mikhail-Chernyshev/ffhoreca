import type { Context } from 'hono';

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export function clientIp(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    ?? c.req.header('x-real-ip')
    ?? c.req.header('cf-connecting-ip')
    ?? 'unknown';
}

/** Returns true if request is allowed, false if rate limited. */
export function rateLimit(
  ip: string,
  bucket: string,
  max: number,
  windowMs: number,
): boolean {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

export function rateLimitOrResponse(
  c: Context,
  bucket: string,
  max: number,
  windowMs: number,
  message = 'Слишком много запросов. Попробуйте позже.',
): Response | null {
  if (rateLimit(clientIp(c), bucket, max, windowMs)) return null;
  return c.json({ error: message }, 429);
}
