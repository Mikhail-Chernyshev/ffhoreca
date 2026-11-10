import { useCallback, useEffect, useState } from 'react';
import type { City, TravelRoute, UserRouteMode } from '../data/types';
import { searchCities, type CitySuggestion } from '../lib/citySearch';
import { cityFromSuggestion } from '../lib/cityFromSuggestion';
import { useLocale, useT } from '../i18n/LocaleContext';
import { routeModeAria } from '../i18n/labels';
import { RouteModeIcon } from './RouteModeIcon';

type Props = {
  onClose: () => void;
  saveCity: (city: City) => Promise<{ ok: boolean; message: string }>;
  saveRoute: (route: TravelRoute) => Promise<{ ok: boolean; message: string }>;
  onComplete: (from: City, to: City, route: TravelRoute) => void | Promise<void>;
};

const MODES: UserRouteMode[] = ['plane', 'train', 'bus', 'boat', 'car'];
const TOTAL_STEPS = 3;

export function FirstTripWizard({ onClose, saveCity, saveRoute, onComplete }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState<City | null>(null);
  const [to, setTo] = useState<City | null>(null);
  const [mode, setMode] = useState<UserRouteMode>('plane');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return;
      if (step > 1) setStep((s) => s - 1);
      else onClose();
    },
    [busy, step, onClose],
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

  const goNext = () => {
    setError(null);
    if (step === 1 && !from) {
      setError(t('firstTrip.pickHint'));
      return;
    }
    if (step === 2) {
      if (!to) {
        setError(t('firstTrip.pickHint'));
        return;
      }
      if (from && to.id === from.id) {
        setError(t('firstTrip.errorSame'));
        return;
      }
    }
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const handleSave = async () => {
    if (!from || !to || from.id === to.id) {
      setError(t('firstTrip.errorSame'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const a = await saveCity(from);
      if (!a.ok) {
        setError(a.message);
        return;
      }
      const b = await saveCity(to);
      if (!b.ok) {
        setError(b.message);
        return;
      }
      const route: TravelRoute = {
        id: `route-${Date.now()}`,
        mode,
        waypoints: [
          { cityId: from.id, name: from.name, lat: from.lat, lng: from.lng },
          { cityId: to.id, name: to.name, lat: to.lat, lng: to.lng },
        ],
      };
      const r = await saveRoute(route);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      await onComplete(from, to, route);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-root" role="presentation">
      <div
        className="modal-dialog first-trip-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-trip-title"
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>
        <div className="modal-dialog__scroll">
          <p className="first-trip-wizard__kicker">
            {t('firstTrip.stepOf', { step, total: TOTAL_STEPS })}
          </p>
          <h2 id="first-trip-title" className="modal-title">
            {t('firstTrip.title')}
          </h2>
          <p className="modal-summary modal-summary--muted">{t('firstTrip.intro')}</p>
          <div className="first-trip-wizard__steps" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={
                  n <= step
                    ? 'first-trip-wizard__dot first-trip-wizard__dot--on'
                    : 'first-trip-wizard__dot'
                }
              />
            ))}
          </div>

          {step === 1 ? (
            <CityPickField
              label={t('firstTrip.from')}
              picked={from}
              onPick={(city) => {
                setFrom(city);
                setError(null);
                setStep(2);
              }}
              onClear={() => setFrom(null)}
            />
          ) : null}

          {step === 2 ? (
            <CityPickField
              label={t('firstTrip.to')}
              picked={to}
              excludeId={from?.id}
              onPick={(city) => {
                if (from && city.id === from.id) {
                  setError(t('firstTrip.errorSame'));
                  return;
                }
                setTo(city);
                setError(null);
                setStep(3);
              }}
              onClear={() => setTo(null)}
            />
          ) : null}

          {step === 3 ? (
            <div className="first-trip-wizard__confirm">
              <p className="first-trip-wizard__summary">
                {t('firstTrip.summary', {
                  from: from?.name ?? '',
                  to: to?.name ?? '',
                })}
              </p>
              <fieldset className="add-place-form__fieldset add-route-mode-fieldset">
                <legend className="add-place-form__legend">{t('firstTrip.mode')}</legend>
                <div
                  className="add-route-mode-picker"
                  role="radiogroup"
                  aria-label={t('firstTrip.mode')}
                >
                  {MODES.map((m) => (
                    <label
                      key={m}
                      className={`add-route-mode-picker__option${
                        mode === m ? ' add-route-mode-picker__option--active' : ''
                      }`}
                      aria-label={routeModeAria(locale, m)}
                    >
                      <input
                        type="radio"
                        name="first-trip-mode"
                        value={m}
                        checked={mode === m}
                        onChange={() => setMode(m)}
                        className="add-route-mode-picker__input"
                      />
                      <RouteModeIcon mode={m} />
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          {error ? (
            <p className="first-trip-wizard__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="first-trip-wizard__actions">
            {step > 1 ? (
              <button
                type="button"
                className="first-trip-wizard__back"
                onClick={() => {
                  setError(null);
                  setStep((s) => s - 1);
                }}
                disabled={busy}
              >
                {t('firstTrip.back')}
              </button>
            ) : (
              <button type="button" className="first-trip-wizard__skip" onClick={onClose}>
                {t('firstTrip.skip')}
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button type="button" className="first-trip-wizard__next" onClick={goNext}>
                {t('firstTrip.next')}
              </button>
            ) : (
              <button
                type="button"
                className="first-trip-wizard__next"
                onClick={() => void handleSave()}
                disabled={busy}
              >
                {busy ? t('common.saving') : t('firstTrip.save')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CityPickField({
  label,
  picked,
  excludeId,
  onPick,
  onClear,
}: {
  label: string;
  picked: City | null;
  excludeId?: string;
  onPick: (city: City) => void;
  onClear: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debouncing, setDebouncing] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ac = new AbortController();
    const id = window.setTimeout(() => {
      setDebouncing(false);
      setLoading(true);
      setNoResults(false);
      setSuggestions([]);
      void (async () => {
        try {
          const list = await searchCities(q, ac.signal);
          if (!ac.signal.aborted) {
            setSuggestions(list);
            setNoResults(list.length === 0);
          }
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            setSuggestions([]);
            setNoResults(true);
          }
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      })();
    }, 400);
    return () => {
      window.clearTimeout(id);
      ac.abort();
    };
  }, [query]);

  const apply = (s: CitySuggestion) => {
    const city = cityFromSuggestion(s);
    if (!city) {
      setPickError(t('firstTrip.errorCountry'));
      return;
    }
    if (excludeId && city.id === excludeId) {
      setPickError(t('firstTrip.errorSame'));
      return;
    }
    setPickError(null);
    onPick(city);
    setQuery(s.name);
    setOpen(false);
    setSuggestions([]);
  };

  if (picked) {
    return (
      <div className="first-trip-wizard__picked">
        <span className="first-trip-wizard__picked-label">{label}</span>
        <strong>
          {picked.name}
          <span className="first-trip-wizard__picked-code"> {picked.countryCode}</span>
        </strong>
        <button type="button" className="first-trip-wizard__change" onClick={onClear}>
          {t('firstTrip.change')}
        </button>
      </div>
    );
  }

  const showList =
    open &&
    query.trim().length >= 2 &&
    (debouncing || loading || suggestions.length > 0 || noResults);

  return (
    <label className="add-place-form__label">
      {label}
      <span className="add-place-form__hint">{t('firstTrip.pickHint')}</span>
      <div className="add-place-form__autocomplete">
        <input
          className="add-place-form__input"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            if (v.trim().length < 2) {
              setSuggestions([]);
              setLoading(false);
              setDebouncing(false);
              setNoResults(false);
            } else {
              setDebouncing(true);
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 180);
          }}
          autoComplete="off"
          placeholder={t('firstTrip.searchPlaceholder')}
          aria-autocomplete="list"
        />
        {showList ? (
          <ul className="add-place-form__suggestions" role="listbox">
            {(debouncing || (loading && suggestions.length === 0)) && !noResults ? (
              <li
                className="add-place-form__suggestion add-place-form__suggestion--muted"
                role="presentation"
              >
                {t('common.searching')}
              </li>
            ) : null}
            {!debouncing && !loading && noResults ? (
              <li
                className="add-place-form__suggestion add-place-form__suggestion--muted"
                role="presentation"
              >
                {t('common.emptyResults')}
              </li>
            ) : null}
            {suggestions.map((s, i) => (
              <li key={`${s.name}-${s.label}-${s.lat}-${s.lng}-${i}`} role="none">
                <button
                  type="button"
                  className="add-place-form__suggestion"
                  role="option"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    apply(s);
                  }}
                >
                  <span className="add-place-form__suggestion-title">{s.name}</span>
                  <span className="add-place-form__suggestion-sub">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {pickError ? (
        <span className="first-trip-wizard__error" role="alert">
          {pickError}
        </span>
      ) : null}
    </label>
  );
}
