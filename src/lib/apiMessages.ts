import { getAppLocale } from '../i18n/localeStore';
import { translate } from '../i18n/messages';

export function apiMessage(
  key: string,
  vars?: Record<string, string | number>,
): string {
  return translate(getAppLocale(), key, vars);
}

function apiErrorMessage(status: number, text: string): string {
  if (text) return apiMessage('api.serverError', { status, text: text.slice(0, 200) });
  return apiMessage('api.httpError', { status });
}

export { apiErrorMessage };
