import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cityById, placeCoordinates } from '../data/selectors';
import type { Catalog, City, Place } from '../data/types';
import { useLocale, useT } from '../i18n/LocaleContext';
import {
  fieldMatchesQuery,
  normalizeSearchText,
  searchQueryVariants,
} from '../lib/transliterate';

export type MapSearchHit =
  | { kind: 'city'; city: City }
  | { kind: 'place'; place: Place };

function hitName(h: MapSearchHit): string {
  return h.kind === 'city' ? h.city.name : h.place.name;
}

function hitCoords(catalog: Catalog, h: MapSearchHit): [number, number] {
  if (h.kind === 'city') return [h.city.lng, h.city.lat];
  return placeCoordinates(catalog, h.place);
}

function collectHits(catalog: Catalog): MapSearchHit[] {
  const hits: MapSearchHit[] = [];
  for (const c of catalog.cities) hits.push({ kind: 'city', city: c });
  for (const p of catalog.places) hits.push({ kind: 'place', place: p });
  return hits;
}

function matchScore(name: string, id: string, q: string): number {
  const variants = searchQueryVariants(q);
  if (variants.length === 0) return 99;

  const n = normalizeSearchText(name);
  const slug = normalizeSearchText(id);

  for (const qq of variants) {
    if (n === qq || slug === qq) return 0;
    if (n.startsWith(qq) || slug.startsWith(qq)) return 1;
    if (fieldMatchesQuery(name, [qq]) || fieldMatchesQuery(id, [qq])) return 2;
  }
  return 99;
}

function filterHits(
  catalog: Catalog,
  query: string,
  limit: number,
  locale: string,
): MapSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const all = collectHits(catalog);
  return all
    .map((h) => ({
      h,
      s: matchScore(
        hitName(h),
        h.kind === 'city' ? h.city.id : h.place.id,
        q,
      ),
    }))
    .filter((x) => x.s < 99)
    .sort((a, b) => {
      if (a.s !== b.s) return a.s - b.s;
      return hitName(a.h).localeCompare(hitName(b.h), locale);
    })
    .slice(0, limit)
    .map((x) => x.h);
}

function findExactHit(catalog: Catalog, input: string): MapSearchHit | null {
  const t = input.trim();
  if (!t) return null;
  const lower = normalizeSearchText(t);
  const city = catalog.cities.find(
    (c) => normalizeSearchText(c.name) === lower,
  );
  if (city) return { kind: 'city', city };
  const place = catalog.places.find(
    (p) => normalizeSearchText(p.name) === lower,
  );
  if (place) return { kind: 'place', place };
  return null;
}

const SUGGESTION_LIMIT = 10;

type Props = {
  catalog: Catalog;
  onFlyTo: (lng: number, lat: number) => void;
};

export function MapSearchBar({ catalog, onFlyTo }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const hitSubtitle = useCallback(
    (h: MapSearchHit): string => {
      if (h.kind === 'city') return t('search.cityKind');
      const c = cityById(catalog, h.place.cityId);
      return c?.name ?? '';
    },
    [catalog, t],
  );

  const suggestions = useMemo(
    () => filterHits(catalog, query, SUGGESTION_LIMIT, locale),
    [catalog, query, locale],
  );

  const exactHit = useMemo(() => findExactHit(catalog, query), [catalog, query]);

  const navigateToHit = useCallback(
    (h: MapSearchHit) => {
      const [lng, lat] = hitCoords(catalog, h);
      onFlyTo(lng, lat);
      setQuery(hitName(h));
      setOpen(false);
    },
    [catalog, onFlyTo],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const showList = open && query.trim().length > 0 && suggestions.length > 0;

  return (
    <div className='map-search' ref={rootRef}>
      <div className='map-search__row'>
        <div className='map-search__field'>
          <input
            id={`${listId}-input`}
            type='search'
            className='map-search__input'
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter' && exactHit) {
                e.preventDefault();
                navigateToHit(exactHit);
              }
            }}
            autoComplete='off'
            role='combobox'
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-autocomplete='list'
          />
          {showList ? (
            <ul
              id={listId}
              className='map-search__list'
              role='listbox'
              aria-label={t('search.ariaSuggestions')}
            >
              {suggestions.map((h) => {
                const id =
                  h.kind === 'city' ? `city-${h.city.id}` : `place-${h.place.id}`;
                return (
                  <li key={id} role='presentation'>
                    <button
                      type='button'
                      role='option'
                      className='map-search__option'
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigateToHit(h);
                      }}
                    >
                      <span className='map-search__option-name'>{hitName(h)}</span>
                      <span className='map-search__option-meta'>
                        {hitSubtitle(h)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <button
          type='button'
          className='map-search__go'
          disabled={exactHit == null}
          onClick={() => {
            if (exactHit) navigateToHit(exactHit);
          }}
        >
          {t('search.go')}
        </button>
      </div>
    </div>
  );
}
