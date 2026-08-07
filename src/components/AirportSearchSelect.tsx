import { useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog } from '../data/types';
import { airportsForRoutePicker } from '../data/selectors';
import { searchAirports, type AirportSuggestion } from '../lib/airportSearch';
import { cityMatchesQuery } from '../lib/transliterate';
import { useT } from '../i18n/LocaleContext';

export type AirportPick =
  | { kind: 'catalog'; placeId: string }
  | { kind: 'remote'; suggestion: AirportSuggestion };

type ListItem =
  | {
      key: string;
      kind: 'catalog';
      placeId: string;
      name: string;
      secondary: string;
    }
  | {
      key: string;
      kind: 'remote';
      suggestion: AirportSuggestion;
      name: string;
      secondary: string;
    };

type Props = {
  catalog: Catalog;
  value: string;
  onPick: (pick: AirportPick) => void | Promise<void>;
  placeholder?: string;
  required?: boolean;
  busy?: boolean;
};

function catalogMatchesQuery(
  name: string,
  cityName: string,
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;
  return (
    cityMatchesQuery({ name, id: name, countryCode: '' }, q) ||
    cityMatchesQuery({ name: cityName, id: cityName, countryCode: '' }, q)
  );
}

export function AirportSearchSelect({
  catalog,
  value,
  onPick,
  placeholder,
  required = false,
  busy = false,
}: Props) {
  const t = useT();
  const resolvedPlaceholder = placeholder ?? t('addRoute.placeholderOriginAirport');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remote, setRemote] = useState<AirportSuggestion[]>([]);
  const [noResults, setNoResults] = useState(false);
  const pickBusy = useRef(false);

  const catalogAirports = useMemo(() => airportsForRoutePicker(catalog), [catalog]);
  const selected = catalogAirports.find((a) => a.placeId === value);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setRemote([]);
      setNoResults(false);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setNoResults(false);
      void (async () => {
        try {
          const list = await searchAirports(q, ac.signal);
          if (ac.signal.aborted) return;
          setRemote(list);
          setNoResults(list.length === 0);
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          if (!ac.signal.aborted) {
            setRemote([]);
            setNoResults(true);
          }
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      })();
    }, 400);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [query, open]);

  const items: ListItem[] = useMemo(() => {
    const q = query.trim();
    const local = catalogAirports
      .filter((a) => catalogMatchesQuery(a.name, a.cityName, q))
      .map(
        (a): ListItem => ({
          key: `c:${a.placeId}`,
          kind: 'catalog',
          placeId: a.placeId,
          name: a.name,
          secondary: a.cityName,
        }),
      );

    const localKeys = new Set(
      catalogAirports.map(
        (a) =>
          `${a.name.toLowerCase()}|${a.lat.toFixed(3)}|${a.lng.toFixed(3)}`,
      ),
    );

    const remoteItems: ListItem[] = [];
    for (const s of remote) {
      const key = `${s.placeName.toLowerCase()}|${s.lat.toFixed(3)}|${s.lng.toFixed(3)}`;
      if (localKeys.has(key)) continue;
      const already =
        s.googlePlaceId &&
        catalogAirports.some((a) => a.placeId === `gplace-${s.googlePlaceId}`);
      if (already) continue;
      remoteItems.push({
        key: `r:${s.googlePlaceId ?? key}`,
        kind: 'remote',
        suggestion: s,
        name: s.placeName,
        secondary: s.cityName || s.label,
      });
    }

    // Каталог сверху, потом поиск; без запроса — только каталог
    if (!q) return local.slice(0, 16);
    return [...local, ...remoteItems].slice(0, 16);
  }, [catalogAirports, remote, query]);

  const pick = async (item: ListItem) => {
    if (pickBusy.current || busy) return;
    pickBusy.current = true;
    try {
      if (item.kind === 'catalog') {
        await onPick({ kind: 'catalog', placeId: item.placeId });
      } else {
        await onPick({ kind: 'remote', suggestion: item.suggestion });
      }
      setQuery('');
      setOpen(false);
    } finally {
      pickBusy.current = false;
    }
  };

  const displayClosed = selected
    ? `${selected.name} · ${selected.cityName}`
    : query;

  return (
    <div className="city-search-select">
      <input
        type="text"
        className="add-place-form__input"
        value={open ? query : displayClosed}
        placeholder={resolvedPlaceholder}
        required={required && !value}
        autoComplete="off"
        disabled={busy}
        onFocus={() => {
          setOpen(true);
          setQuery(selected?.name ?? '');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open ? (
        <ul className="city-search-select__list" role="listbox">
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                className="city-search-select__option"
                role="option"
                aria-selected={
                  item.kind === 'catalog' && item.placeId === value
                }
                disabled={busy}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void pick(item);
                }}
              >
                <span className="city-search-select__name">{item.name}</span>
                {item.secondary ? (
                  <span className="city-search-select__cc">
                    {item.secondary}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {loading ? (
            <li className="city-search-select__empty" role="presentation">
              {t('common.loading')}
            </li>
          ) : null}
          {!loading && noResults && items.length === 0 && query.trim().length >= 2 ? (
            <li className="city-search-select__empty" role="presentation">
              {t('common.emptyResults')}
            </li>
          ) : null}
          {!loading &&
          query.trim().length > 0 &&
          query.trim().length < 2 ? (
            <li className="city-search-select__empty" role="presentation">
              {t('addRoute.airportSearchHint')}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
