import { useMemo, useState, type FormEvent } from 'react';
import type { Catalog, RouteWaypoint, TravelRoute, UserRouteMode } from '../data/types';
import {
  airportsForRoutePicker,
  catalogCitiesListed,
} from '../data/selectors';
import { postRoute } from '../lib/apiRoutes';
import { RouteModeIcon } from './RouteModeIcon';
import {
  CitySearchSelect,
  cityOptionMatchesQuery,
  cityOptionsFromCatalog,
  type SearchSelectOption,
} from './CitySearchSelect';
import { useLocale, useT } from '../i18n/LocaleContext';
import { routeModeAria } from '../i18n/labels';

type Props = {
  catalog: Catalog;
  onClose: () => void;
  onSaved: () => void;
  saveRoute?: (route: TravelRoute) => Promise<{ ok: boolean; message: string }>;
};

const MODES: UserRouteMode[] = ['plane', 'train', 'bus', 'boat', 'car'];

function cityToWaypoint(cityId: string, catalog: Catalog): RouteWaypoint | null {
  const city = catalog.cities.find((c) => c.id === cityId);
  if (!city) return null;
  return { cityId: city.id, name: city.name, lat: city.lat, lng: city.lng };
}

function airportToWaypoint(
  placeId: string,
  catalog: Catalog,
): RouteWaypoint | null {
  const airport = airportsForRoutePicker(catalog).find((a) => a.placeId === placeId);
  if (!airport) return null;
  return {
    cityId: airport.cityId,
    placeId: airport.placeId,
    name: airport.name,
    lat: airport.lat,
    lng: airport.lng,
  };
}

export function AddRouteModal({ catalog, onClose, onSaved, saveRoute }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [mode, setMode] = useState<UserRouteMode>('plane');
  const [waypointIds, setWaypointIds] = useState<string[]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listedCities = useMemo(() => catalogCitiesListed(catalog), [catalog]);
  const airports = useMemo(() => airportsForRoutePicker(catalog), [catalog]);
  const citiesById = useMemo(
    () => new Map(listedCities.map((c) => [c.id, c])),
    [listedCities],
  );

  const pickerOptions: SearchSelectOption[] = useMemo(() => {
    if (mode === 'plane') {
      return airports.map((a) => ({
        id: a.placeId,
        name: a.name,
        secondary: a.cityName,
      }));
    }
    return cityOptionsFromCatalog(listedCities);
  }, [mode, airports, listedCities]);

  const waypointPlaceholder = (index: number, total: number): string => {
    if (mode === 'plane') {
      if (index === 0) return t('addRoute.placeholderOriginAirport');
      if (total >= 2 && index === total - 1) return t('addRoute.placeholderDestinationAirport');
      return t('addRoute.placeholderViaAirport');
    }
    if (index === 0) return t('addRoute.placeholderOrigin');
    if (total >= 2 && index === total - 1) return t('addRoute.placeholderDestination');
    return t('addRoute.placeholderVia');
  };

  const setWaypointAt = (index: number, value: string) => {
    setWaypointIds((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const addWaypoint = () => {
    setWaypointIds((prev) => [...prev, '']);
  };

  const removeWaypoint = (index: number) => {
    if (waypointIds.length <= 2) return;
    setWaypointIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleModeChange = (next: UserRouteMode) => {
    setMode(next);
    setWaypointIds((prev) => prev.map(() => ''));
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'plane' && airports.length === 0) {
      setError(t('addRoute.errorNoAirports'));
      return;
    }

    const waypoints: RouteWaypoint[] = [];
    for (let i = 0; i < waypointIds.length; i++) {
      const id = waypointIds[i]!.trim();
      if (!id) {
        setError(t('addRoute.errorAllWaypoints'));
        return;
      }
      const wp =
        mode === 'plane' ? airportToWaypoint(id, catalog) : cityToWaypoint(id, catalog);
      if (!wp) {
        setError(
          mode === 'plane'
            ? t('addRoute.errorAirportNotFound', { id })
            : t('addRoute.errorCityNotFound', { id }),
        );
        return;
      }
      waypoints.push(wp);
    }

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i]!;
      const b = waypoints[i + 1]!;
      const same =
        mode === 'plane'
          ? (a.placeId ?? a.cityId) === (b.placeId ?? b.cityId)
          : a.cityId === b.cityId;
      if (same) {
        setError(t('addRoute.errorAdjacentDuplicate'));
        return;
      }
    }

    const route: TravelRoute = {
      id: `route-${Date.now()}`,
      waypoints,
      mode,
    };

    setBusy(true);
    try {
      const result = await (saveRoute ? saveRoute(route) : postRoute(route));
      if (!result.ok) { setError(result.message); return; }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-root"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal-dialog modal-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-route-modal-title"
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>

        <h2 id="add-route-modal-title" className="modal-title">{t('addRoute.title')}</h2>
        <p className="modal-summary modal-summary--muted">
          {mode === 'plane' ? t('addRoute.introPlane') : t('addRoute.intro')}
        </p>
        {mode === 'plane' ? (
          <p className="modal-summary modal-summary--muted">{t('addRoute.transitHint')}</p>
        ) : null}

        <form className="add-place-form" onSubmit={handleSubmit}>

          <fieldset className="add-place-form__fieldset add-route-mode-fieldset">
            <legend className="add-place-form__legend">{t('addRoute.transportMode')}</legend>
            <div className="add-route-mode-picker" role="radiogroup" aria-label={t('addRoute.transportMode')}>
              {MODES.map((m) => (
                <label
                  key={m}
                  className={`add-route-mode-picker__option${mode === m ? ' add-route-mode-picker__option--active' : ''}`}
                  aria-label={routeModeAria(locale, m)}
                >
                  <input
                    type="radio"
                    name="route-mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => handleModeChange(m)}
                    className="add-route-mode-picker__input"
                  />
                  <RouteModeIcon mode={m} />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="add-route-waypoints">
            <div className="add-place-form__legend" style={{ marginBottom: '0.5rem' }}>
              {t('addRoute.waypoints')}
            </div>
            {waypointIds.map((selectedId, i) => (
              <div key={i} className="add-route-waypoints__row">
                <span className="add-route-waypoints__letter">
                  {String.fromCharCode(65 + i)}
                </span>
                <CitySearchSelect
                  options={pickerOptions}
                  value={selectedId}
                  onChange={(id) => setWaypointAt(i, id)}
                  placeholder={waypointPlaceholder(i, waypointIds.length)}
                  required
                  matchesQuery={
                    mode === 'plane'
                      ? undefined
                      : (option, q) => cityOptionMatchesQuery(option, q, citiesById)
                  }
                />
                {waypointIds.length > 2 && (
                  <button
                    type="button"
                    className="add-route-waypoints__remove"
                    onClick={() => removeWaypoint(i)}
                    aria-label={t('addRoute.ariaRemoveWaypoint')}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="modal-rating__add"
              onClick={addWaypoint}
              style={{ marginTop: '0.25rem' }}
            >
              {t('addRoute.addVia')}
            </button>
          </div>

          {error && <p className="add-place-form__error">{error}</p>}

          <div className="add-place-form__actions">
            <button type="button" className="add-place-form__btn add-place-form__btn--ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="add-place-form__btn" disabled={busy}>
              {busy ? t('common.saving') : t('addRoute.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
