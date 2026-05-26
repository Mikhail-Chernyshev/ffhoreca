import { useMemo, useState } from 'react';
import type { City } from '../data/types';
import { cityMatchesQuery } from '../lib/transliterate';

type Props = {
  cities: City[];
  value: string;
  onChange: (cityId: string) => void;
  placeholder?: string;
  required?: boolean;
};

export function CitySearchSelect({
  cities,
  value,
  onChange,
  placeholder = 'Начните вводить название…',
  required = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = cities.find((c) => c.id === value);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return cities;
    return cities.filter((c) => cityMatchesQuery(c, q));
  }, [cities, query]);

  const pick = (city: City) => {
    onChange(city.id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="city-search-select">
      <input
        type="text"
        className="add-place-form__input"
        value={open ? query : (selected?.name ?? query)}
        placeholder={placeholder}
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
          {filtered.slice(0, 12).map((c) => (
            <li key={c.id} role="none">
              <button
                type="button"
                className="city-search-select__option"
                role="option"
                aria-selected={c.id === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(c);
                }}
              >
                <span className="city-search-select__name">{c.name}</span>
                <span className="city-search-select__cc">{c.countryCode}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && filtered.length === 0 ? (
        <p className="city-search-select__empty">Ничего не найдено</p>
      ) : null}
    </div>
  );
}
