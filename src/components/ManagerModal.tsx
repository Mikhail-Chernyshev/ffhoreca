import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Catalog, City, Place, PlaceCategory, TravelRoute } from '../data/types';
import { ConfirmModal } from './ConfirmModal';
import { deleteRouteById } from '../lib/apiRoutes';
import { deleteCityById } from '../lib/apiCities';
import { catalogCitiesListed, cityLabelForPlace, placesCountForCity } from '../data/selectors';
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
  /** Если заданы — используются вместо дефолтных admin-API (для карт пользователей) */
  deleteRouteApi?: (id: string) => Promise<{ ok: boolean; message: string }>;
  deleteCityApi?: (id: string) => Promise<{ ok: boolean; message: string }>;
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tipVisible, setTipVisible] = useState(false);
  const [tipStyle, setTipStyle] = useState<CSSProperties>({});
  const deleteBlocked = placesCount > 0;
  const blockedReason = deleteBlocked
    ? t('manager.deleteCityBlockedTooltip', { name: city.name, count: placesCount })
    : undefined;
  const tooltipId = `manager-city-delete-tip-${city.id}`;

  const updateTipPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !deleteBlocked) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const showBelow = r.top < 72;
    setTipStyle({
      position: 'fixed',
      left: r.right,
      top: showBelow ? r.bottom + pad : r.top - pad,
      transform: showBelow ? 'translate(-100%, 0)' : 'translate(-100%, -100%)',
      zIndex: 1300,
    });
  }, [deleteBlocked]);

  const showTip = () => {
    updateTipPosition();
    setTipVisible(true);
  };

  const hideTip = () => setTipVisible(false);

  useEffect(() => {
    if (!tipVisible) return;
    const onScroll = () => hideTip();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [tipVisible]);

  return (
    <div className="manager-row">
      <div className="manager-row__main">
        <span className="manager-row__title">{city.name}</span>
        <span className="manager-row__meta">
          {city.countryCode} · {city.lat.toFixed(2)}, {city.lng.toFixed(2)}
          {placesCount > 0 ? ` ${t('manager.cityPlacesCount', { count: placesCount })}` : ''}
        </span>
      </div>
      <div
        ref={wrapRef}
        className="manager-row__delete-wrap"
        onMouseEnter={deleteBlocked ? showTip : undefined}
        onMouseLeave={deleteBlocked ? hideTip : undefined}
        onFocus={deleteBlocked ? showTip : undefined}
        onBlur={deleteBlocked ? hideTip : undefined}
      >
        <button
          type="button"
          className="manager-row__delete"
          onClick={() => onDeleteRequest(city)}
          disabled={deleteBlocked}
          aria-label={
            deleteBlocked
              ? t('manager.ariaDeleteCityBlocked', { name: city.name })
              : t('manager.ariaDeleteCity', { name: city.name })
          }
          aria-describedby={deleteBlocked ? tooltipId : undefined}
        >
          ✕
        </button>
      </div>
      {deleteBlocked && tipVisible && blockedReason
        ? createPortal(
            <span
              id={tooltipId}
              className="manager-tooltip manager-tooltip--fixed"
              style={tipStyle}
              role="tooltip"
            >
              {blockedReason}
            </span>,
            document.body,
          )
        : null}
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
  deleteRouteApi,
  deleteCityApi,
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
        await (deleteRouteApi ? deleteRouteApi(route.id) : deleteRouteById(route.id));
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
    const placesCount = placesCountForCity(catalog, city.id);
    if (placesCount > 0) return;
    setConfirm({
      title: t('manager.confirmDeleteCityTitle'),
      message: t('manager.confirmDeleteCityMessage', { name: city.name }),
      onConfirm: async () => {
        const r = await (deleteCityApi ? deleteCityApi(city.id) : deleteCityById(city.id));
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

  const listedCities = useMemo(() => catalogCitiesListed(catalog), [catalog]);

  const sortedCities = useMemo(
    () => [...listedCities].sort((a, b) => a.name.localeCompare(b.name, locale)),
    [listedCities, locale],
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
              {t('manager.tabCities', { count: listedCities.length })}
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
                      {placesByCountry[cc]!.map((place) => (
                          <PlaceRow
                            key={place.id}
                            place={place}
                            cityName={cityLabelForPlace(catalog, place)}
                            onEdit={() => { onEditPlace(place); onClose(); }}
                            onDeleteRequest={requestDeletePlace}
                          />
                      ))}
                    </div>
                  ))
            )}

            {tab === 'cities' && (
              listedCities.length === 0
                ? <p className="manager-empty">{t('manager.emptyCities')}</p>
                : sortedCities.map((city) => (
                    <CityRow
                      key={city.id}
                      city={city}
                      placesCount={placesCountForCity(catalog, city.id)}
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
