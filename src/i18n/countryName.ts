import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import ru from 'i18n-iso-countries/langs/ru.json';
import { fieldMatchesQuery, searchQueryVariants } from '../lib/transliterate';
import type { AppLocale } from './localeStore';

countries.registerLocale(ru);
countries.registerLocale(en);

export function countryName(code: string, locale: AppLocale): string {
  const cc = code.trim().toUpperCase();
  if (cc.length !== 2) return code;
  return countries.getName(cc, locale) ?? cc;
}

/** Код или название (ru/en) — чтобы «Таиланд», Thailand и TH находили одно. */
export function countryMatchesQuery(code: string, query: string): boolean {
  const variants = searchQueryVariants(query);
  if (variants.length === 0) return true;
  return (
    fieldMatchesQuery(code, variants) ||
    fieldMatchesQuery(countryName(code, 'ru'), variants) ||
    fieldMatchesQuery(countryName(code, 'en'), variants)
  );
}
