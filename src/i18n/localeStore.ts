export type AppLocale = 'ru' | 'en';

const STORAGE_KEY = 'ffhoreca-locale';

function detectInitialLocale(): AppLocale {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith('ru')) return 'ru';
  }
  return 'en';
}

let appLocale: AppLocale = detectInitialLocale();

export function getAppLocale(): AppLocale {
  return appLocale;
}

export function setAppLocale(locale: AppLocale): void {
  appLocale = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale);
  }
}

setAppLocale(appLocale);
