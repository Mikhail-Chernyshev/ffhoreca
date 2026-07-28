import { exchangeAuthCode, clearLegacyToken } from './apiAuth';

const AUTH_BOOTSTRAP_ERROR_KEY = 'ffhoreca_auth_bootstrap_error';

let bootstrapDone = false;

/** Сообщение после OAuth/exchange — один раз читается в UI. */
export function consumeAuthBootstrapError(): string | null {
  try {
    const v = sessionStorage.getItem(AUTH_BOOTSTRAP_ERROR_KEY);
    if (v) sessionStorage.removeItem(AUTH_BOOTSTRAP_ERROR_KEY);
    return v;
  } catch {
    return null;
  }
}

function storeAuthBootstrapError(code: string): void {
  try {
    sessionStorage.setItem(AUTH_BOOTSTRAP_ERROR_KEY, code);
  } catch {
    /* ignore */
  }
}

/** Обмен auth_code до монтирования React (избегаем StrictMode и гонок). */
export async function bootstrapAuthFromUrl(): Promise<void> {
  if (bootstrapDone) return;
  bootstrapDone = true;

  clearLegacyToken();

  const params = new URLSearchParams(window.location.search);
  const authError = params.get('auth_error')?.trim();
  if (authError) {
    storeAuthBootstrapError(authError);
  }

  const authCode = params.get('auth_code')?.trim();
  if (authCode) {
    const ok = await exchangeAuthCode(authCode);
    if (!ok) storeAuthBootstrapError('exchange_failed');
  }

  if (!authCode && !authError) return;

  params.delete('auth_code');
  params.delete('auth_token');
  params.delete('auth_ok');
  params.delete('auth_error');
  const rest = params.toString();
  const newUrl = window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash;
  window.history.replaceState(null, '', newUrl);
}
