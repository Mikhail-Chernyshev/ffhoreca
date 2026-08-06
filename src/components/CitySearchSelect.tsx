import { useMemo, useState } from 'react';
import type { City } from '../data/types';
import { useT } from '../i18n/LocaleContext';
import { cityMatchesQuery } from '../lib/transliterate';

export type SearchSelectOption = {
  id: string;
  name: string;
  /** Вторая строка / код страны / город */
  secondary?: string;
};

type Props = {
  options: SearchSelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Кастомный матч по запросу; по умолчанию — name + secondary */
  matchesQuery?: (option: SearchSelectOption, query: string) => boolean;
};

function defaultMatches(option: SearchSelectOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (option.name.toLowerCase().includes(q)) return true;
  if (option.secondary?.toLowerCase().includes(q)) return true;
  return false;
}

export function CitySearchSelect({
  options,
  value,
  onChange,
  placeholder,
  required = false,
  matchesQuery = defaultMatches,
}: Props) {
  const t = useT();
  const resolvedPlaceholder = placeholder ?? t('citySelect.placeholder');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter((o) => matchesQuery(o, q));
  }, [options, query, matchesQuery]);

  const pick = (option: SearchSelectOption) => {
    onChange(option.id);
    setQuery('');
    setOpen(false);
  };

  const displayClosed = selected
    ? selected.secondary
      ? `${selected.name} · ${selected.secondary}`
      : selected.name
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
      {open && filtered.length > 0 ? (
        <ul className="city-search-select__list" role="listbox">
          {filtered.slice(0, 16).map((o) => (
            <li key={o.id} role="none">
              <button
                type="button"
                className="city-search-select__option"
                role="option"
                aria-selected={o.id === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
              >
                <span className="city-search-select__name">{o.name}</span>
                {o.secondary ? (
                  <span className="city-search-select__cc">{o.secondary}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && filtered.length === 0 ? (
        <p className="city-search-select__empty">{t('common.emptyResults')}</p>
      ) : null}
    </div>
  );
}

/** Хелпер: города каталога → options для пикера */
export function cityOptionsFromCatalog(cities: City[]): SearchSelectOption[] {
  return cities.map((c) => ({
    id: c.id,
    name: c.name,
    secondary: c.countryCode,
  }));
}

/** Поиск городов с учётом транслита (как раньше) */
export function cityOptionMatchesQuery(
  option: SearchSelectOption,
  query: string,
  citiesById: Map<string, City>,
): boolean {
  const city = citiesById.get(option.id);
  if (city) return cityMatchesQuery(city, query);
  return defaultMatches(option, query);
}
