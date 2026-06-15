import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'ffhoreca';
const DEV_JWT_SECRET = 'dev_jwt_secret_change_in_production_32chars';
export const AUTH_COOKIE_NAME = 'ffhoreca_session';

const oauthStates = new Map<string, number>();

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

export function createOAuthState(): string {
  const state = crypto.randomBytes(24).toString('hex');
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  return state;
}

export function consumeOAuthState(state: string): boolean {
  const exp = oauthStates.get(state);
  if (!exp || Date.now() > exp) {
    oauthStates.delete(state);
    return false;
  }
  oauthStates.delete(state);
  return true;
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
