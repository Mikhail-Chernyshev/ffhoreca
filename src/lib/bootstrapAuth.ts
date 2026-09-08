import { exchangeAuthCode, fetchCurrentUser } from './apiAuth';

const AUTH_BOOTSTRAP_ERROR_KEY = 'ffhoreca_auth_bootstrap_error';
const LOGIN_RETURN_PATH_KEY = 'ffhoreca_login_return_path';

let bootstrapDone = false;

export function consumeAuthBootstrapError(): string | null {
  try {
    const error = sessionStorage.getItem(AUTH_BOOTSTRAP_ERROR_KEY);
    if (error) sessionStorage.removeItem(AUTH_BOOTSTRAP_ERROR_KEY);
    return error;
  } catch {
    return null;
  }
}

function storeAuthBootstrapError(code: string): void {
  try {
    sessionStorage.setItem(AUTH_BOOTSTRAP_ERROR_KEY, code);
  } catch {
    // ignore
  }
}

/** Remember current page so Google OAuth can return here (private map follow request). */
export function rememberLoginReturnPath(): void {
  try {
    sessionStorage.setItem(LOGIN_RETURN_PATH_KEY, window.location.pathname + window.location.search);
  } catch {
    // ignore
  }
}

function consumeLoginReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(LOGIN_RETURN_PATH_KEY);
    if (path) sessionStorage.removeItem(LOGIN_RETURN_PATH_KEY);
    return path;
  } catch {
    return null;
  }
}

function isAppHomePath(pathWithSearch: string): boolean {
  const path = (pathWithSearch.split('?')[0] || '/').replace(/\/$/, '') || '/';
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '';
  return path === '/' || path === '' || path === base;
}

function stripAuthParams(): string {
  const params = new URLSearchParams(window.location.search);
  params.delete('auth_code');
  params.delete('auth_token');
  params.delete('auth_ok');
  params.delete('auth_error');
  const rest = params.toString();
  return window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash;
}

export async function bootstrapAuthFromUrl(): Promise<void> {
  if (bootstrapDone) {
    return;
  }
  bootstrapDone = true;

  const params = new URLSearchParams(window.location.search);
  const authError = params.get('auth_error')?.trim();
  if (authError) {
    storeAuthBootstrapError(authError);
  }

  const authCode = params.get('auth_code')?.trim();
  let ownMapPath: string | null = null;

  if (authCode) {
    const ok = await exchangeAuthCode(authCode);
    if (!ok) {
      storeAuthBootstrapError('exchange_failed');
    } else {
      const user = await fetchCurrentUser();
      if (user?.username) {
        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        ownMapPath = `${base}/${encodeURIComponent(user.username)}`;
      }
    }
  }

  if (!authCode && !authError) return;

  const savedPath = consumeLoginReturnPath();
  const next =
    authCode && savedPath && !isAppHomePath(savedPath)
      ? savedPath
      : (ownMapPath ?? stripAuthParams());
  window.history.replaceState(null, '', next);
}
