import { useCallback, useEffect, useState } from 'react';
import type { Catalog, City, Place, TravelRoute } from '../data/types';
import { CATEGORY_LABELS } from './PlaceModal';
import { ConfirmModal } from './ConfirmModal';
import { USER_ROUTE_MODE_LABELS, deleteRouteById } from '../lib/apiRoutes';
import { deleteCityById } from '../lib/apiCities';
import { cityById } from '../data/selectors';

type Tab = 'routes' | 'places' | 'cities';

type Props = {
  routes: TravelRoute[];
  catalog: Catalog;
  onClose: () => void;
  onRoutesChanged: () => void;
  onCitiesChanged: () => void;
  onDeletePlace: (id: string) => Promise<boolean>;
  onEditPlace: (place: Place) => void;
};

type ConfirmState = {
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
} | null;

// ---------------------------------------------------------------------------
// Строка города
// ---------------------------------------------------------------------------
function CityRow({
  city,
  placesCount,
  onDeleteRequest,
}: {
  city: City;
  placesCount: number;
  onDeleteRequest: (city: City) => void;
}) {
  return (
    <div className="manager-row">
      <div className="manager-row__main">
        <span className="manager-row__title">{city.name}</span>
        <span className="manager-row__meta">
          {city.countryCode} · {city.lat.toFixed(2)}, {city.lng.toFixed(2)}
          {placesCount > 0 ? ` · ${placesCount} мест` : ''}
        </span>
      </div>
      <button
        type="button"
        className="manager-row__delete"
        onClick={() => onDeleteRequest(city)}
        aria-label={`Удалить город ${city.name}`}
      >
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Строка маршрута
// ---------------------------------------------------------------------------
function RouteRow({
  route,
  onDeleteRequest,
}: {
  route: TravelRoute;
  onDeleteRequest: (route: TravelRoute) => void;
}) {
  const waypointNames = route.waypoints.map((w) => w.name).join(' → ');

  return (
    <div className="manager-row">
      <div className="manager-row__main">
        <span className="manager-row__title">{waypointNames}</span>
        <span className="manager-row__meta">{USER_ROUTE_MODE_LABELS[route.mode]}</span>
      </div>
      <button
        type="button"
        className="manager-row__delete"
        onClick={() => onDeleteRequest(route)}
        aria-label="Удалить маршрут"
      >
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Строка места
// ---------------------------------------------------------------------------
function PlaceRow({
  place,
  cityName,
  onEdit,
  onDeleteRequest,
}: {
  place: Place;
  cityName: string;
  onEdit: () => void;
  onDeleteRequest: (place: Place) => void;
}) {
  const catLabels = place.categories.map((c) => CATEGORY_LABELS[c]).join(', ');

  return (
    <div className="manager-row">
      <div className="manager-row__main">
        <button type="button" className="manager-row__title manager-row__title--link" onClick={onEdit}>
          {place.name}
        </button>
        <span className="manager-row__meta">
          {cityName} · {catLabels}
          {place.googleRating != null ? ` · ★ ${place.googleRating.toFixed(1)}` : ''}
        </span>
      </div>
      <button
        type="button"
        className="manager-row__delete"
        onClick={() => onDeleteRequest(place)}
        aria-label="Удалить место"
      >
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Основной компонент
// ---------------------------------------------------------------------------
export function ManagerModal({
  routes,
  catalog,
  onClose,
  onRoutesChanged,
  onCitiesChanged,
  onDeletePlace,
  onEditPlace,
}: Props) {
  const [tab, setTab] = useState<Tab>('routes');
  const [localRoutes, setLocalRoutes] = useState(routes);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => { setLocalRoutes(routes); }, [routes]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirm) { setConfirm(null); return; }
      onClose();
    },
    [onClose, confirm],
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

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try { await confirm.onConfirm(); }
    finally { setConfirmBusy(false); setConfirm(null); }
  };

  const requestDeleteRoute = (route: TravelRoute) => {
    const names = route.waypoints.map((w) => w.name).join(' → ');
    setConfirm({
      title: 'Удалить маршрут?',
      message: `Маршрут «${names}» будет удалён.`,
      onConfirm: async () => {
        await deleteRouteById(route.id);
        setLocalRoutes((prev) => prev.filter((r) => r.id !== route.id));
        onRoutesChanged();
      },
    });
  };

  const requestDeletePlace = (place: Place) => {
    setConfirm({
      title: 'Удалить место?',
      message: `Место «${place.name}» будет удалено без возможности восстановления.`,
      onConfirm: async () => {
        await onDeletePlace(place.id);
      },
    });
  };

  const requestDeleteCity = (city: City) => {
    const placesCount = catalog.places.filter((p) => p.cityId === city.id).length;
    if (placesCount > 0) {
      window.alert(
        `Город «${city.name}» нельзя удалить: в нём ${placesCount} мест(а). Сначала удалите места.`,
      );
      return;
    }
    setConfirm({
      title: 'Удалить город?',
      message: `Город «${city.name}» будет удалён из каталога.`,
      onConfirm: async () => {
        const r = await deleteCityById(city.id);
        if (!r.ok) {
          window.alert(r.message);
          return;
        }
        onCitiesChanged();
      },
    });
  };

  // Места по странам
  const placesByCountry = catalog.places.reduce<Record<string, Place[]>>((acc, p) => {
    const key = p.countryCode || '??';
    (acc[key] ??= []).push(p);
    return acc;
  }, {});
  const sortedCountries = Object.keys(placesByCountry).sort((a, b) => a.localeCompare(b, 'ru'));

  return (
    <>
      <div
        className="modal-root"
        role="presentation"
        onMouseDown={(e) => { if (e.target === e.currentTarget && !confirm) onClose(); }}
      >
        <div
          className="modal-dialog modal-dialog--wide modal-dialog--manager"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manager-modal-title"
        >
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">×</button>

          <h2 id="manager-modal-title" className="modal-title">Управление</h2>

          <div className="manager-tabs">
            <button
              type="button"
              className={`manager-tabs__btn${tab === 'routes' ? ' manager-tabs__btn--active' : ''}`}
              onClick={() => setTab('routes')}
            >
              Маршруты ({localRoutes.length})
            </button>
            <button
              type="button"
              className={`manager-tabs__btn${tab === 'places' ? ' manager-tabs__btn--active' : ''}`}
              onClick={() => setTab('places')}
            >
              Места ({catalog.places.length})
            </button>
            <button
              type="button"
              className={`manager-tabs__btn${tab === 'cities' ? ' manager-tabs__btn--active' : ''}`}
              onClick={() => setTab('cities')}
            >
              Города ({catalog.cities.length})
            </button>
          </div>

          <div className="manager-content">
            {tab === 'routes' && (
              localRoutes.length === 0
                ? <p className="manager-empty">Маршрутов пока нет.</p>
                : localRoutes.map((route) => (
                    <RouteRow key={route.id} route={route} onDeleteRequest={requestDeleteRoute} />
                  ))
            )}

            {tab === 'places' && (
              catalog.places.length === 0
                ? <p className="manager-empty">Мест пока нет.</p>
                : sortedCountries.map((cc) => (
                    <div key={cc} className="manager-group">
                      <h3 className="manager-group__heading">{cc}</h3>
                      {placesByCountry[cc]!.map((place) => {
                        const city = cityById(catalog, place.cityId);
                        return (
                          <PlaceRow
                            key={place.id}
                            place={place}
                            cityName={city?.name ?? place.cityId}
                            onEdit={() => { onEditPlace(place); onClose(); }}
                            onDeleteRequest={requestDeletePlace}
                          />
                        );
                      })}
                    </div>
                  ))
            )}

            {tab === 'cities' && (
              catalog.cities.length === 0
                ? <p className="manager-empty">Городов пока нет.</p>
                : [...catalog.cities]
                    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                    .map((city) => (
                      <CityRow
                        key={city.id}
                        city={city}
                        placesCount={catalog.places.filter((p) => p.cityId === city.id).length}
                        onDeleteRequest={requestDeleteCity}
                      />
                    ))
            )}
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          busy={confirmBusy}
          onConfirm={() => void runConfirm()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
