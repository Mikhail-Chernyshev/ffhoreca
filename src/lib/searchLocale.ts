export type SearchLanguage = 'ru' | 'en';

/** Язык результатов поиска: кириллица → ru, латиница → en, иначе — язык браузера */
export function searchLanguageForQuery(query: string): SearchLanguage {
  const q = query.trim();
  if (/[\u0400-\u04FF]/.test(q)) return 'ru';
  if (/[A-Za-z]/.test(q)) return 'en';
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('ru')) return 'ru';
  }
  return 'en';
}

/** Photon: ru не поддерживается, для en — en, иначе default */
export function photonLangForQuery(query: string): 'default' | 'en' {
  return searchLanguageForQuery(query) === 'en' ? 'en' : 'default';
}

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const LATIN_RE = /[A-Za-z]/;

export function hasArabicScript(text: string): boolean {
  return ARABIC_RE.test(text);
}

export function hasCyrillicScript(text: string): boolean {
  return CYRILLIC_RE.test(text);
}

export function hasLatinScript(text: string): boolean {
  return LATIN_RE.test(text);
}

/** Название на «чужой» вязи относительно того, что ввёл пользователь */
export function isForeignScriptName(name: string, query: string): boolean {
  const qLang = searchLanguageForQuery(query);
  if (hasArabicScript(name) && qLang !== 'en') return true;
  if (hasCyrillicScript(name) && qLang === 'en' && !hasCyrillicScript(query)) return true;
  return false;
}

/** Предпочесть кириллицу/латиницу вместо арабской вязи и т.п. */
export function pickReadablePlaceName(
  name: string,
  query: string,
  alternatives: readonly string[] = [],
): string {
  const candidates = [name, ...alternatives].filter((n) => n.trim().length > 0);
  if (!isForeignScriptName(name, query)) return name;

  const qLang = searchLanguageForQuery(query);
  if (qLang === 'ru') {
    const cyr = candidates.find(hasCyrillicScript);
    if (cyr) return cyr;
  }
  const latin = candidates.find((n) => hasLatinScript(n) && !hasArabicScript(n));
  if (latin) return latin;
  return name;
}
