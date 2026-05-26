const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function normalizeSearchText(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е');
}

/** Кириллица → латиница для нечёткого поиска (Лови → lovi). */
export function cyrillicToLatin(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim();
}

/** Варианты строки запроса: как введено + латинская транслитерация. */
export function searchQueryVariants(query: string): string[] {
  const norm = normalizeSearchText(query);
  if (!norm) return [];
  const out = new Set<string>([norm]);
  const latin = cyrillicToLatin(norm);
  if (latin.length >= 2) out.add(latin);
  return [...out];
}

export function latinSearchHint(name: string): string | null {
  if (!/[а-яё]/i.test(name)) return null;
  const out = cyrillicToLatin(name);
  return out.length >= 2 ? out : null;
}

/** Совпадает ли поле (название, id…) с любым вариантом запроса. */
export function fieldMatchesQuery(field: string, queryVariants: readonly string[]): boolean {
  const norm = normalizeSearchText(field);
  if (!norm) return false;
  const latin = cyrillicToLatin(norm) || norm;
  for (const q of queryVariants) {
    if (!q) continue;
    if (norm.includes(q) || latin.includes(q)) return true;
  }
  return false;
}

export function cityMatchesQuery(
  city: { name: string; id: string; countryCode: string },
  query: string,
): boolean {
  const variants = searchQueryVariants(query);
  if (variants.length === 0) return true;
  return (
    fieldMatchesQuery(city.name, variants) ||
    fieldMatchesQuery(city.id, variants) ||
    fieldMatchesQuery(city.countryCode, variants)
  );
}
