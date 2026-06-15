import type { City } from '../data/types';
import { cyrillicToLatin, latinSearchHint } from './transliterate';

/** Варианты id для public/geo/cities/{id}.json (кириллица в id → латинский slug) */
export function localGeoBoundaryIds(city: City): string[] {
  const out = new Set<string>([city.id]);
  const parts = city.id.split('-');
  if (parts.length < 2) return [...out];

  const cc = parts[0]!.toLowerCase();
  const slug = parts.slice(1).join('-');
  if (/^[a-z0-9-]+$/.test(slug)) {
    out.add(`${cc}-${slug}`);
  }

  const latinSlug = cyrillicToLatin(slug.replace(/-/g, ' ')).replace(/\s+/g, '-');
  if (latinSlug.length >= 2) {
    out.add(`${cc}-${latinSlug}`);
  }

  return [...out];
}

/** Запросы Nominatim: имя, транслит, slug из id, известные алиасы */
export function cityBoundarySearchQueries(city: City): string[] {
  const out = new Set<string>();

  const push = (q: string | null | undefined) => {
    const s = q?.trim();
    if (s && s.length >= 2) out.add(s);
  };

  push(city.name);
  push(latinSearchHint(city.name));

  for (const id of localGeoBoundaryIds(city)) {
    const slug = id.split('-').slice(1).join(' ');
    push(slug);
  }

  if (city.id === 'th-bangkok' || city.id === 'th-бангкок') {
    push('bangkok');
    push('Bangkok');
  }

  return [...out];
}
