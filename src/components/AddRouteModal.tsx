import { useState, type FormEvent } from 'react';
import type { Catalog, RouteWaypoint, TravelRoute, UserRouteMode } from '../data/types';
import { USER_ROUTE_MODE_LABELS, postRoute } from '../lib/apiRoutes';
import { CitySearchSelect } from './CitySearchSelect';

type Props = {
  catalog: Catalog;
  onClose: () => void;
  onSaved: () => void;
};

const MODES: UserRouteMode[] = ['plane', 'train', 'bus', 'boat'];

function cityToWaypoint(cityId: string, catalog: Catalog): RouteWaypoint | null {
  const city = catalog.cities.find((c) => c.id === cityId);
  if (!city) return null;
  return { cityId: city.id, name: city.name, lat: city.lat, lng: city.lng };
}

export function AddRouteModal({ catalog, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<UserRouteMode>('plane');
  const [waypointIds, setWaypointIds] = useState<string[]>([
    catalog.cities[0]?.id ?? '',
    catalog.cities[1]?.id ?? catalog.cities[0]?.id ?? '',
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setWaypointAt = (index: number, value: string) => {
    setWaypointIds((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const addWaypoint = () => {
    setWaypointIds((prev) => [...prev, catalog.cities[0]?.id ?? '']);
  };

  const removeWaypoint = (index: number) => {
    if (waypointIds.length <= 2) return;
    setWaypointIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const waypoints: RouteWaypoint[] = [];
    for (const id of waypointIds) {
      const wp = cityToWaypoint(id, catalog);
      if (!wp) { setError(`Город не найден: ${id}`); return; }
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
          <fieldset className="add-place-form__fieldset">
            <legend className="add-place-form__legend">Вид транспорта</legend>
            <div className="add-place-form__cats">
              {MODES.map((m) => (
                <label key={m} className="add-place-form__check">
                  <input
                    type="radio"
                    name="route-mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                  />
                  {USER_ROUTE_MODE_LABELS[m]}
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
