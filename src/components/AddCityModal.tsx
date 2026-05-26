import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Catalog, City } from '../data/types';
import { postCity } from '../lib/apiCities';
import { makeCityId } from '../lib/makeCityId';
import { searchCities, type CitySuggestion } from '../lib/citySearch';
import { useT } from '../i18n/LocaleContext';

type Props = {
  catalog: Catalog;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

function buildCity(form: {
  name: string;
  countryCode: string;
  lng: string;
  lat: string;
  summary: string;
  story: string;
  photosRaw: string;
}): City | null {
  const name = form.name.trim();
  const countryCode = form.countryCode.trim().toUpperCase();
  if (!name || countryCode.length !== 2) return null;

  const lo = Number(form.lng.replace(',', '.'));
  const la = Number(form.lat.replace(',', '.'));
  if (Number.isNaN(lo) || Number.isNaN(la)) return null;

  const summary = form.summary.trim();
  const story = form.story.trim();
  const lines = form.photosRaw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const photos = lines.length > 0 ? lines : undefined;

  return {
    id: makeCityId(countryCode, name),
    name,
    countryCode,
    lng: Math.round(lo * 1e4) / 1e4,
    lat: Math.round(la * 1e4) / 1e4,
    ...(summary ? { summary } : {}),
    ...(story ? { story } : {}),
    ...(photos ? { photos } : {}),
  };
}

export function AddCityModal({ catalog, onClose, onSaved }: Props) {
  const t = useT();
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [lng, setLng] = useState('');
  const [lat, setLat] = useState('');
  const [summary, setSummary] = useState('');
  const [story, setStory] = useState('');
  const photosRaw = '';

  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [citySuggestOpen, setCitySuggestOpen] = useState(false);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [citySearchDebouncing, setCitySearchDebouncing] = useState(false);
  const [cityNoResults, setCityNoResults] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onKey]);

  useEffect(() => {
    const q = citySearchQuery.trim();
    if (q.length < 2) return;

    const ac = new AbortController();
    const t = window.setTimeout(() => {
      setCitySearchDebouncing(false);
      setCitySearchLoading(true);
      setCityNoResults(false);
      setCitySuggestions([]);
      void (async () => {
        try {
          const list = await searchCities(q, ac.signal);
          if (!ac.signal.aborted) {
            setCitySuggestions(list);
            setCityNoResults(list.length === 0);
          }
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            setCitySuggestions([]);
            setCityNoResults(true);
          }
        } finally {
          if (!ac.signal.aborted) setCitySearchLoading(false);
        }
      })();
    }, 400);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [citySearchQuery]);

  const applyCitySuggestion = (s: CitySuggestion) => {
    setName(s.name);
    setLng(String(Math.round(s.lng * 1e6) / 1e6));
    setLat(String(Math.round(s.lat * 1e6) / 1e6));
    if (s.countryCode) setCountryCode(s.countryCode.toUpperCase());
    setCitySearchQuery(s.name);
    setCitySuggestOpen(false);
    setCitySuggestions([]);
    setCityNoResults(false);
    setCitySearchDebouncing(false);
    setCitySearchLoading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const city = buildCity({
      name,
      countryCode,
      lng,
      lat,
      summary,
      story,
      photosRaw,
    });
    if (!city) {
      setError(t('addCity.errorRequired'));
      return;
    }

    const existing = catalog.cities.find((c) => c.id === city.id);
    if (existing) {
      setError(t('addCity.errorDuplicate', { name: existing.name, id: existing.id }));
      return;
    }

    setBusy(true);
    try {
      const result = await postCity(city);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className='modal-root'
      role='presentation'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className='modal-dialog modal-dialog--wide modal-dialog--add-place'
        role='dialog'
        aria-modal='true'
        aria-labelledby='add-city-modal-title'
      >
        <button
          type='button'
          className='modal-close'
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>

        <h2 id='add-city-modal-title' className='modal-title'>
          {t('addCity.title')}
        </h2>
        <p className='modal-summary modal-summary--muted'>
          {t('addCity.intro')}
        </p>

        <form className='add-place-form' onSubmit={handleSubmit}>
          <label className='add-place-form__label'>
            {t('addCity.search')}
            <span className='add-place-form__hint'>
              {t('addCity.searchHint')}
            </span>
            <div className='add-place-form__autocomplete'>
              <input
                className='add-place-form__input'
                value={citySearchQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setCitySearchQuery(v);
                  setCitySuggestOpen(true);
                  if (v.trim().length < 2) {
                    setCitySuggestions([]);
                    setCitySearchLoading(false);
                    setCitySearchDebouncing(false);
                    setCityNoResults(false);
                  } else {
                    setCitySearchDebouncing(true);
                  }
                }}
                onFocus={() => setCitySuggestOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setCitySuggestOpen(false), 180);
                }}
                autoComplete='off'
                placeholder={t('addCity.searchPlaceholder')}
                aria-autocomplete='list'
                aria-expanded={
                  citySuggestOpen &&
                  citySearchQuery.trim().length >= 2 &&
                  (citySearchDebouncing ||
                    citySearchLoading ||
                    citySuggestions.length > 0 ||
                    cityNoResults)
                }
                aria-controls='add-city-photon-suggestions'
              />
              {citySuggestOpen &&
              citySearchQuery.trim().length >= 2 &&
              (citySearchDebouncing ||
                citySearchLoading ||
                citySuggestions.length > 0 ||
                cityNoResults) ? (
                <ul
                  id='add-city-photon-suggestions'
                  className='add-place-form__suggestions'
                  role='listbox'
                >
                  {(citySearchDebouncing ||
                    (citySearchLoading && citySuggestions.length === 0)) &&
                  !cityNoResults ? (
                    <li
                      className='add-place-form__suggestion add-place-form__suggestion--muted'
                      role='presentation'
                    >
                      {t('common.searching')}
                    </li>
                  ) : null}
                  {!citySearchDebouncing &&
                  !citySearchLoading &&
                  cityNoResults ? (
                    <li
                      className='add-place-form__suggestion add-place-form__suggestion--muted'
                      role='presentation'
                    >
                      {t('common.emptyResults')}
                    </li>
                  ) : null}
                  {citySuggestions.map((s, i) => (
                    <li
                      key={`${s.name}-${s.label}-${s.lat}-${s.lng}-${i}`}
                      role='none'
                    >
                      <button
                        type='button'
                        className='add-place-form__suggestion'
                        role='option'
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyCitySuggestion(s);
                        }}
                      >
                        <span className='add-place-form__suggestion-title'>
                          {s.name}
                        </span>
                        <span className='add-place-form__suggestion-sub'>
                          {s.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </label>

          <label className='add-place-form__label'>
            {t('addCity.countryCode')}
            <input
              className='add-place-form__input'
              value={countryCode}
              onChange={(e) =>
                setCountryCode(e.target.value.toUpperCase().slice(0, 2))
              }
              required
              maxLength={2}
              placeholder='RU'
            />
          </label>

          <div className='add-place-form__row'>
            <label className='add-place-form__label'>
              {t('addCity.lng')}
              <input
                className='add-place-form__input'
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
                inputMode='decimal'
              />
            </label>
            <label className='add-place-form__label'>
              {t('addCity.lat')}
              <input
                className='add-place-form__input'
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
                inputMode='decimal'
              />
            </label>
          </div>

          <label className='add-place-form__label'>
            {t('addCity.summaryOptional')}
            <input
              className='add-place-form__input'
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>

          <label className='add-place-form__label'>
            {t('addCity.storyOptional')}
            <textarea
              className='add-place-form__textarea'
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={3}
            />
          </label>

          {error ? <p className='add-place-form__error'>{error}</p> : null}

          <div className='add-place-form__actions'>
            <button
              type='button'
              className='add-place-form__btn add-place-form__btn--ghost'
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <button
              type='submit'
              className='add-place-form__btn'
              disabled={busy}
            >
              {busy ? t('common.saving') : t('addCity.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
