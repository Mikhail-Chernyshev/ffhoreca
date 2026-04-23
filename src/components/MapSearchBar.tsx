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

export type MapSearchHit =
  | { kind: 'city'; city: City }
  | { kind: 'place'; place: Place };

function hitName(h: MapSearchHit): string {
  return h.kind === 'city' ? h.city.name : h.place.name;
}

function hitSubtitle(catalog: Catalog, h: MapSearchHit): string {
  if (h.kind === 'city') return 'Город';
  const c = cityById(catalog, h.place.cityId);
  return c?.name ?? '';
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

function matchScore(name: string, q: string): number {
  const n = name.toLowerCase();
  const qq = q.toLowerCase();
  if (qq === '') return 99;
  if (n === qq) return 0;
  if (n.startsWith(qq)) return 1;
  if (n.includes(qq)) return 2;
  return 99;
}

function filterHits(
  catalog: Catalog,
  query: string,
  limit: number,
): MapSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const all = collectHits(catalog);
  return all
    .map((h) => ({ h, s: matchScore(hitName(h), q) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => {
      if (a.s !== b.s) return a.s - b.s;
      return hitName(a.h).localeCompare(hitName(b.h), 'ru');
    })
    .slice(0, limit)
    .map((x) => x.h);
}

function findExactHit(catalog: Catalog, input: string): MapSearchHit | null {
  const t = input.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  const city = catalog.cities.find(
    (c) => c.name.trim().toLowerCase() === lower,
  );
  if (city) return { kind: 'city', city };
  const place = catalog.places.find(
    (p) => p.name.trim().toLowerCase() === lower,
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
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(
    () => filterHits(catalog, query, SUGGESTION_LIMIT),
    [catalog, query],
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
            placeholder='Город или место из каталога…'
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
              aria-label='Подсказки поиска'
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
                        {hitSubtitle(catalog, h)}
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
          Перейти
        </button>
      </div>
    </div>
  );
}
