import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'ffhoreca';
const DEV_JWT_SECRET = 'dev_jwt_secret_change_in_production_32chars';
export const AUTH_COOKIE_NAME = 'ffhoreca_session';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim() ?? DEV_JWT_SECRET;
  return new TextEncoder().encode(secret);
}

/** Падает при старте в проде, если JWT_SECRET не задан или дефолтный. */
export function assertJwtSecretConfigured(): void {
  const secret = process.env.JWT_SECRET?.trim();
  const isProd =
    process.env.NODE_ENV === 'production'
    || Boolean(process.env.FLY_APP_NAME?.trim());
  if (!isProd) return;
  if (!secret || secret === DEV_JWT_SECRET) {
    throw new Error('JWT_SECRET must be set to a strong random value in production');
  }
}

export interface JWTPayload {
  sub: string; // user.id (UUID)
}

export async function signJWT(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { issuer: ISSUER });
    if (typeof payload.sub !== 'string') return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

function useSecureCookies(): boolean {
  if (process.env.COOKIE_SECURE === 'false') return false;
  const frontend = (process.env.FRONTEND_URL ?? '').trim();
  return process.env.NODE_ENV === 'production'
    || Boolean(process.env.FLY_APP_NAME?.trim())
    || frontend.startsWith('https://');
}

function sessionCookieFlags(): string {
  const secure = useSecureCookies();
  const sameSite = secure ? 'None' : 'Lax';
  const parts = ['Path=/', 'HttpOnly', 'Max-Age=2592000', `SameSite=${sameSite}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function sessionCookieHeader(jwt: string): string {
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(jwt)}; ${sessionCookieFlags()}`;
}

export function clearSessionCookieHeader(): string {
  const secure = useSecureCookies();
  const sameSite = secure ? 'None' : 'Lax';
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    `SameSite=${sameSite}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readSessionTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

export function createOAuthState(db: Database.Database): string {
  const now = Date.now();
  db.prepare('DELETE FROM oauth_states WHERE exp < ?').run(now);
  const state = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO oauth_states (state, exp) VALUES (?, ?)').run(
    state,
    now + 10 * 60 * 1000,
  );
  return state;
}

export function consumeOAuthState(db: Database.Database, state: string): boolean {
  const now = Date.now();
  db.prepare('DELETE FROM oauth_states WHERE exp < ?').run(now);
  const row = db.prepare('SELECT exp FROM oauth_states WHERE state = ?').get(state) as
    | { exp: number }
    | undefined;
  if (!row) return false;
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  return row.exp >= now;
}

/** Одноразовый код для обмена на JWT после OAuth (cookie не работает github.io → fly.dev). */
export function createAuthExchangeCode(db: Database.Database, jwt: string): string {
  const now = Date.now();
  db.prepare('DELETE FROM auth_exchange_codes WHERE exp < ?').run(now);
  const code = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO auth_exchange_codes (code, jwt, exp) VALUES (?, ?, ?)').run(
    code,
    jwt,
    now + 2 * 60 * 1000,
  );
  return code;
}

export function consumeAuthExchangeCode(db: Database.Database, code: string): string | null {
  const now = Date.now();
  db.prepare('DELETE FROM auth_exchange_codes WHERE exp < ?').run(now);
  const row = db.prepare('SELECT jwt, exp FROM auth_exchange_codes WHERE code = ?').get(code) as
    | { jwt: string; exp: number }
    | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM auth_exchange_codes WHERE code = ?').run(code);
  if (row.exp < now) return null;
  return row.jwt;
}

// ---- Google OAuth ----------------------------------------------------------

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export function getGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<GoogleUserInfo | null> {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    console.error('Google token exchange failed:', await tokenRes.text());
    return null;
  }

  const tokens = (await tokenRes.json()) as { access_token: string };

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) return null;
  return userRes.json() as Promise<GoogleUserInfo>;
}
