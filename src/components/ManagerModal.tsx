import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Catalog, City, Place, PlaceCategory, TravelRoute } from '../data/types';
import { ConfirmModal } from './ConfirmModal';
import { deleteRouteById } from '../lib/apiRoutes';
import { deleteCityById } from '../lib/apiCities';
import { cityById } from '../data/selectors';
import { useLocale, useT } from '../i18n/LocaleContext';
import { categoryLabel, routeModeLabel } from '../i18n/labels';

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

function CityRow({
  city,
  placesCount,
  onDeleteRequest,
}: {
  city: City;
  placesCount: number;
  onDeleteRequest: (city: City) => void;
}) {
  const t = useT();
  return (
    <div className="manager-row">
      <div className="manager-row__main">
        <span className="manager-row__title">{city.name}</span>
        <span className="manager-row__meta">
          {city.countryCode} · {city.lat.toFixed(2)}, {city.lng.toFixed(2)}
          {placesCount > 0 ? ` ${t('manager.cityPlacesCount', { count: placesCount })}` : ''}
        </span>
      </div>
      <button
        type="button"
        className="manager-row__delete"
        onClick={() => onDeleteRequest(city)}
        aria-label={t('manager.ariaDeleteCity', { name: city.name })}
      >
        ✕
      </button>
    </div>
  );
}

function RouteRow({
  route,
  onDeleteRequest,
}: {
  route: TravelRoute;
  onDeleteRequest: (route: TravelRoute) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const waypointNames = route.waypoints.map((w) => w.name).join(' → ');

  return (
    <div className="manager-row">
      <div className="manager-row__main">
        <span className="manager-row__title">{waypointNames}</span>
        <span className="manager-row__meta">{routeModeLabel(locale, route.mode)}</span>
      </div>
      <button
        type="button"
        className="manager-row__delete"
        onClick={() => onDeleteRequest(route)}
        aria-label={t('manager.ariaDeleteRoute')}
      >
        ✕
      </button>
    </div>
  );
}

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
  const t = useT();
  const { locale } = useLocale();
  const catLabels = place.categories
    .map((c: PlaceCategory) => categoryLabel(locale, c))
    .join(', ');

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
        aria-label={t('manager.ariaDeletePlace')}
      >
        ✕
      </button>
    </div>
  );
}

export function ManagerModal({
  routes,
  catalog,
  onClose,
  onRoutesChanged,
  onCitiesChanged,
  onDeletePlace,
  onEditPlace,
}: Props) {
  const t = useT();
  const { locale } = useLocale();
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
      title: t('manager.confirmDeleteRouteTitle'),
      message: t('manager.confirmDeleteRouteMessage', { names }),
      onConfirm: async () => {
        await deleteRouteById(route.id);
        setLocalRoutes((prev) => prev.filter((r) => r.id !== route.id));
        onRoutesChanged();
      },
    });
  };

  const requestDeletePlace = (place: Place) => {
    setConfirm({
      title: t('manager.confirmDeletePlaceTitle'),
      message: t('manager.confirmDeletePlaceMessage', { name: place.name }),
      onConfirm: async () => {
        await onDeletePlace(place.id);
      },
    });
  };

  const requestDeleteCity = (city: City) => {
    const placesCount = catalog.places.filter((p) => p.cityId === city.id).length;
    if (placesCount > 0) {
      window.alert(
        t('manager.alertDeleteCityBlocked', { name: city.name, count: placesCount }),
      );
      return;
    }
    setConfirm({
      title: t('manager.confirmDeleteCityTitle'),
      message: t('manager.confirmDeleteCityMessage', { name: city.name }),
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

  const placesByCountry = useMemo(
    () =>
      catalog.places.reduce<Record<string, Place[]>>((acc, p) => {
        const key = p.countryCode || '??';
        (acc[key] ??= []).push(p);
        return acc;
      }, {}),
    [catalog.places],
  );

  const sortedCountries = useMemo(
    () => Object.keys(placesByCountry).sort((a, b) => a.localeCompare(b, locale)),
    [placesByCountry, locale],
  );

  const sortedCities = useMemo(
    () => [...catalog.cities].sort((a, b) => a.name.localeCompare(b.name, locale)),
    [catalog.cities, locale],
  );

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
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>

          <h2 id="manager-modal-title" className="modal-title">{t('manager.title')}</h2>

          <div className="manager-tabs">
            <button
              type="button"
              className={`manager-tabs__btn${tab === 'routes' ? ' manager-tabs__btn--active' : ''}`}
              onClick={() => setTab('routes')}
            >
              {t('manager.tabRoutes', { count: localRoutes.length })}
            </button>
            <button
              type="button"
              className={`manager-tabs__btn${tab === 'places' ? ' manager-tabs__btn--active' : ''}`}
              onClick={() => setTab('places')}
            >
              {t('manager.tabPlaces', { count: catalog.places.length })}
            </button>
            <button
              type="button"
              className={`manager-tabs__btn${tab === 'cities' ? ' manager-tabs__btn--active' : ''}`}
              onClick={() => setTab('cities')}
            >
              {t('manager.tabCities', { count: catalog.cities.length })}
            </button>
          </div>

          <div className="manager-content">
            {tab === 'routes' && (
              localRoutes.length === 0
                ? <p className="manager-empty">{t('manager.emptyRoutes')}</p>
                : localRoutes.map((route) => (
                    <RouteRow key={route.id} route={route} onDeleteRequest={requestDeleteRoute} />
                  ))
            )}

            {tab === 'places' && (
              catalog.places.length === 0
                ? <p className="manager-empty">{t('manager.emptyPlaces')}</p>
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
                ? <p className="manager-empty">{t('manager.emptyCities')}</p>
                : sortedCities.map((city) => (
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
