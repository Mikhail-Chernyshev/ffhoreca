import { useState, type FormEvent } from 'react';
import type { Catalog, RouteWaypoint, TravelRoute, UserRouteMode } from '../data/types';
import { USER_ROUTE_MODE_ARIA, postRoute } from '../lib/apiRoutes';
import { RouteModeIcon } from './RouteModeIcon';
import { CitySearchSelect } from './CitySearchSelect';

type Props = {
  catalog: Catalog;
  onClose: () => void;
  onSaved: () => void;
};

const MODES: UserRouteMode[] = ['plane', 'train', 'bus', 'boat', 'car'];

function cityToWaypoint(cityId: string, catalog: Catalog): RouteWaypoint | null {
  const city = catalog.cities.find((c) => c.id === cityId);
  if (!city) return null;
  return { cityId: city.id, name: city.name, lat: city.lat, lng: city.lng };
}

function waypointPlaceholder(index: number, total: number): string {
  if (index === 0) return 'Выберите город отправления…';
  if (total >= 2 && index === total - 1) return 'Выберите город назначения…';
  return 'Выберите промежуточный город…';
}

export function AddRouteModal({ catalog, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<UserRouteMode>('plane');
  const [waypointIds, setWaypointIds] = useState<string[]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const waypoints: RouteWaypoint[] = [];
    for (let i = 0; i < waypointIds.length; i++) {
      const id = waypointIds[i]!.trim();
      if (!id) {
        setError('Выберите город для каждой точки маршрута (не место).');
        return;
      }
      const wp = cityToWaypoint(id, catalog);
      if (!wp) {
        setError(`Город не найден: ${id}`);
        return;
      }
      waypoints.push(wp);
    }

    // Проверим уникальность последовательных точек
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (waypoints[i]!.cityId === waypoints[i + 1]!.cityId) {
        setError('Два соседних пункта не могут совпадать.'); return;
      }
    }

    const route: TravelRoute = {
      id: `route-${Date.now()}`,
      waypoints,
      mode,
    };

    setBusy(true);
    try {
      const result = await postRoute(route);
      if (!result.ok) { setError(result.message); return; }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">×</button>

        <h2 id="add-route-modal-title" className="modal-title">Добавить маршрут</h2>

        <form className="add-place-form" onSubmit={handleSubmit}>

          {/* Транспорт */}
          <fieldset className="add-place-form__fieldset add-route-mode-fieldset">
            <legend className="add-place-form__legend">Вид транспорта</legend>
            <div className="add-route-mode-picker" role="radiogroup" aria-label="Вид транспорта">
              {MODES.map((m) => (
                <label
                  key={m}
                  className={`add-route-mode-picker__option${mode === m ? ' add-route-mode-picker__option--active' : ''}`}
                  aria-label={USER_ROUTE_MODE_ARIA[m]}
                >
                  <input
                    type="radio"
                    name="route-mode"
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

          {/* Точки маршрута */}
          <div className="add-route-waypoints">
            <div className="add-place-form__legend" style={{ marginBottom: '0.5rem' }}>
              Точки маршрута
            </div>
            {waypointIds.map((cityId, i) => (
              <div key={i} className="add-route-waypoints__row">
                <span className="add-route-waypoints__letter">
                  {String.fromCharCode(65 + i)}
                </span>
                <CitySearchSelect
                  cities={catalog.cities}
                  value={cityId}
                  onChange={(id) => setWaypointAt(i, id)}
                  placeholder={waypointPlaceholder(i, waypointIds.length)}
                  required
                />
                {waypointIds.length > 2 && (
                  <button
                    type="button"
                    className="add-route-waypoints__remove"
                    onClick={() => removeWaypoint(i)}
                    aria-label="Удалить точку"
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
              + Добавить промежуточную точку
            </button>
          </div>

          {error && <p className="add-place-form__error">{error}</p>}

          <div className="add-place-form__actions">
            <button type="button" className="add-place-form__btn add-place-form__btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="add-place-form__btn" disabled={busy}>
              {busy ? 'Сохранение…' : 'Сохранить маршрут'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
