import { useMemo, useState, type FormEvent } from 'react';
import type { Catalog, City, Place, RouteWaypoint, TravelRoute, UserRouteMode } from '../data/types';
import {
  airportsForRoutePicker,
  catalogCitiesListed,
} from '../data/selectors';
import { postRoute } from '../lib/apiRoutes';
import {
  buildAirportPlaceAndCity,
  findExistingAirportPlace,
} from '../lib/buildAirportPlace';
import { RouteModeIcon } from './RouteModeIcon';
import {
  CitySearchSelect,
  cityOptionMatchesQuery,
  cityOptionsFromCatalog,
} from './CitySearchSelect';
import { AirportSearchSelect, type AirportPick } from './AirportSearchSelect';
import { useLocale, useT } from '../i18n/LocaleContext';
import { routeModeAria } from '../i18n/labels';

type Props = {
  catalog: Catalog;
  onClose: () => void;
  onSaved: () => void;
  saveRoute?: (route: TravelRoute) => Promise<{ ok: boolean; message: string }>;
  /** Сохранить город + аэропорт при выборе из поиска (plane) */
  savePlace?: (place: Place, city: City) => Promise<{ ok: boolean; message?: string }>;
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
  extras: Place[],
): RouteWaypoint | null {
  const place =
    catalog.places.find((p) => p.id === placeId) ??
    extras.find((p) => p.id === placeId);
  if (!place?.categories.includes('airport')) {
    const fromPicker = airportsForRoutePicker(catalog).find((a) => a.placeId === placeId);
    if (!fromPicker) return null;
    return {
      cityId: fromPicker.cityId,
      placeId: fromPicker.placeId,
      name: fromPicker.name,
      lat: fromPicker.lat,
      lng: fromPicker.lng,
    };
  }
  const lat = place.lat;
  const lng = place.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return {
    cityId: place.cityId,
    placeId: place.id,
    name: place.name,
    lat,
    lng,
  };
}

export function AddRouteModal({
  catalog,
  onClose,
  onSaved,
  saveRoute,
  savePlace,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [mode, setMode] = useState<UserRouteMode>('plane');
  const [waypointIds, setWaypointIds] = useState<string[]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Города/аэропорты, добавленные в этой сессии до обновления catalog prop */
  const [sessionPlaces, setSessionPlaces] = useState<Place[]>([]);
  const [sessionCities, setSessionCities] = useState<City[]>([]);

  const listedCities = useMemo(() => catalogCitiesListed(catalog), [catalog]);
  const citiesById = useMemo(
    () => new Map(listedCities.map((c) => [c.id, c])),
    [listedCities],
  );

  const catalogWithSession: Catalog = useMemo(
    () => ({
      cities: [
        ...catalog.cities,
        ...sessionCities.filter((c) => !catalog.cities.some((x) => x.id === c.id)),
      ],
      places: [
        ...catalog.places,
        ...sessionPlaces.filter((p) => !catalog.places.some((x) => x.id === p.id)),
      ],
    }),
    [catalog, sessionPlaces, sessionCities],
  );

  const pickerOptions = useMemo(
    () => cityOptionsFromCatalog(listedCities),
    [listedCities],
  );

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

  const handleAirportPick = async (index: number, pick: AirportPick) => {
    setError(null);
    if (pick.kind === 'catalog') {
      setWaypointAt(index, pick.placeId);
      return;
    }

    const existing = findExistingAirportPlace(catalogWithSession, pick.suggestion);
    if (existing) {
      setWaypointAt(index, existing.id);
      return;
    }

    if (!savePlace) {
      setError(t('addRoute.errorAirportSaveUnavailable'));
      return;
    }

    const built = buildAirportPlaceAndCity(catalogWithSession, pick.suggestion, {
      summary: t('addRoute.autoAirportSummary'),
      story: t('addRoute.autoAirportStory'),
    });

    if ('error' in built) {
      setError(
        built.error === 'missingCountry'
          ? t('addRoute.errorAirportCountry')
          : t('addRoute.errorAirportCity'),
      );
      return;
    }

    setPickingIndex(index);
    try {
      const r = await savePlace(built.place, built.city);
      if (!r.ok) {
        setError(r.message || t('addRoute.errorAirportSaveFailed'));
        return;
      }
      setSessionPlaces((prev) =>
        prev.some((p) => p.id === built.place.id) ? prev : [...prev, built.place],
      );
      if (!built.cityExisted) {
        setSessionCities((prev) =>
          prev.some((c) => c.id === built.city.id) ? prev : [...prev, built.city],
        );
      }
      setWaypointAt(index, built.place.id);
    } finally {
      setPickingIndex(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const waypoints: RouteWaypoint[] = [];
    for (let i = 0; i < waypointIds.length; i++) {
      const id = waypointIds[i]!.trim();
      if (!id) {
        setError(t('addRoute.errorAllWaypoints'));
        return;
      }
      const wp =
        mode === 'plane'
          ? airportToWaypoint(id, catalogWithSession, sessionPlaces)
          : cityToWaypoint(id, catalog);
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

        <div className="modal-dialog__scroll">
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
                {mode === 'plane' ? (
                  <AirportSearchSelect
                    catalog={catalogWithSession}
                    value={selectedId}
                    onPick={(pick) => handleAirportPick(i, pick)}
                    placeholder={waypointPlaceholder(i, waypointIds.length)}
                    required
                    busy={busy || pickingIndex === i}
                  />
                ) : (
                  <CitySearchSelect
                    options={pickerOptions}
                    value={selectedId}
                    onChange={(id) => setWaypointAt(i, id)}
                    placeholder={waypointPlaceholder(i, waypointIds.length)}
                    required
                    matchesQuery={(option, q) =>
                      cityOptionMatchesQuery(option, q, citiesById)
                    }
                  />
                )}
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
            <button type="submit" className="add-place-form__btn" disabled={busy || pickingIndex != null}>
              {busy ? t('common.saving') : t('addRoute.save')}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
