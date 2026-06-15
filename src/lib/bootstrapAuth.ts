import { exchangeAuthCode, clearLegacyToken } from './apiAuth';

let bootstrapDone = false;

/** Обмен auth_code до монтирования React (избегаем StrictMode и гонок). */
export async function bootstrapAuthFromUrl(): Promise<void> {
  if (bootstrapDone) return;
  bootstrapDone = true;

  clearLegacyToken();

  const params = new URLSearchParams(window.location.search);
  const authCode = params.get('auth_code')?.trim();
  if (!authCode) return;

  await exchangeAuthCode(authCode);

  params.delete('auth_code');
  params.delete('auth_token');
  params.delete('auth_ok');
  const rest = params.toString();
  const newUrl = window.location.pathname + (rest ? `?${rest}` : '');
  window.history.replaceState(null, '', newUrl);
}
