import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { WorldMap, type WorldMapRef } from '../components/WorldMap';
import { MapSearchBar } from '../components/MapSearchBar';
import { CategoryTabs } from '../components/CategoryTabs';
import { PlaceModal } from '../components/PlaceModal';
import { CityModal } from '../components/CityModal';
import { AddCityModal } from '../components/AddCityModal';
import { AddPlaceModal } from '../components/AddPlaceModal';
import { AddRouteModal } from '../components/AddRouteModal';
import { ManagerModal } from '../components/ManagerModal';
import { placesForFilter } from '../data/selectors';
import type { Catalog, CategoryFilter, City, Place, TravelRoute } from '../data/types';
import { apiBaseUrl } from '../lib/apiBase';
import { authHeaders } from '../lib/apiAuth';
import {
  userPostCity, userDeleteCity,
  userPostPlace, userDeletePlace,
  userPostRoute, userDeleteRoute,
  userUploadPhotos,
} from '../lib/apiUserCatalog';
import { useT } from '../i18n/LocaleContext';
import { useCurrentUser } from '../hooks/useCurrentUser';

const EMPTY_CATALOG: Catalog = { cities: [], places: [] };

interface ProfileUser {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

export function UserMapPage() {
  const { username } = useParams<{ username: string }>();
  const t = useT();
  const { user: currentUser } = useCurrentUser();

  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [routes, setRoutes] = useState<TravelRoute[]>([]);
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [addCityOpen, setAddCityOpen] = useState(false);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [addRouteOpen, setAddRouteOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  const mapRef = useRef<WorldMapRef>(null);

  const isOwner = !!currentUser && !!username &&
    currentUser.username?.toLowerCase() === username.toLowerCase();

  const base = apiBaseUrl();

  const loadCatalog = useCallback(async () => {
    if (!base || !username) return;
    const headers = isOwner ? authHeaders() : {};
    try {
      const [cat, rts] = await Promise.all([
        fetch(`${base}/api/users/${username}/catalog`, { headers }).then((r) => r.json()),
        fetch(`${base}/api/users/${username}/routes`, { headers }).then((r) => r.json()),
      ]);
      setCatalog(cat as Catalog);
      setRoutes((rts as TravelRoute[]) ?? []);
    } catch { /* ignore, stale data stays */ }
  }, [base, username, isOwner]);

  useEffect(() => {
    if (!base || !username) return;
    setLoading(true);
    setNotFound(false);

    fetch(`${base}/api/users/${username}`)
      .then((r) => r.json())
      .then((data) => {
        const d = data as { error?: string; user?: ProfileUser };
        if (d.error) { setNotFound(true); return; }
        setProfileUser(d.user!);
        return loadCatalog();
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [base, username, loadCatalog]);

  const flyToOnMap = useCallback((lng: number, lat: number) => {
    mapRef.current?.flyToLngLat(lng, lat);
  }, []);

  const visiblePlaces = useMemo(() => placesForFilter(catalog, filter), [catalog, filter]);

  // ---- Owner place handlers ----

  const handlePlaceSaved = useCallback(async (place: Place, city: City) => {
    const r = await userPostPlace(place, city);
    if (!r.ok) { window.alert(r.message); return; }
    await loadCatalog();
  }, [loadCatalog]);

  const handlePlaceDeleted = useCallback(async (placeId: string): Promise<boolean> => {
    const r = await userDeletePlace(placeId);
    if (!r.ok) { window.alert(r.message); return false; }
    await loadCatalog();
    return true;
  }, [loadCatalog]);

  const handlePlaceUpdated = useCallback(async (place: Place) => {
    const city = catalog.cities.find((c) => c.id === place.cityId);
    if (city) await handlePlaceSaved(place, city);
  }, [handlePlaceSaved, catalog.cities]);

  if (!base) {
    return (
      <div className="user-map-page user-map-page--error">
        <p>{t('app.catalogLoadError')}</p>
        <Link to="/" className="user-map-page__back">← {t('userMap.backToShowcase')}</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-map-page user-map-page--loading">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="user-map-page user-map-page--error">
        <p>{t('userMap.notFound', { username: username ?? '' })}</p>
        <Link to="/" className="user-map-page__back">← {t('userMap.backToShowcase')}</Link>
      </div>
    );
  }

  return (
    <div className="user-map-page">
      <div className="user-map-page__header">
        <Link to="/" className="user-map-page__back">← Tips from trips</Link>
        {profileUser && (
          <div className="user-map-page__profile">
            {profileUser.avatar && (
              <img
                src={profileUser.avatar}
                alt={profileUser.name}
                className="user-map-page__avatar"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <span className="user-map-page__name">{profileUser.name}</span>
              <span className="user-map-page__username">@{profileUser.username}</span>
            </div>
          </div>
        )}
      </div>

      <CategoryTabs value={filter} onChange={setFilter} />

      {isOwner && (
        <div className="app-admin-actions">
          <button type="button" className="app-admin-add" onClick={() => setAddCityOpen(true)}>
            {t('app.adminAddCity')}
          </button>
          <button type="button" className="app-admin-add" onClick={() => setAddPlaceOpen(true)}>
            {t('app.adminAddPlace')}
          </button>
          <button type="button" className="app-admin-add" onClick={() => setAddRouteOpen(true)}>
            {t('app.adminAddRoute')}
          </button>
          <button type="button" className="app-admin-add" onClick={() => setManagerOpen(true)}>
            {t('app.adminOpenManager')}
          </button>
        </div>
      )}

      <MapSearchBar catalog={catalog} onFlyTo={flyToOnMap} />

      <WorldMap
        ref={mapRef}
        catalog={catalog}
        filter={filter}
        places={visiblePlaces}
        userRoutes={routes}
        onPlaceClick={setSelectedPlace}
        onCityClick={setSelectedCity}
      />

      <PlaceModal
        key={selectedPlace?.id ?? 'closed'}
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        adminMode={isOwner}
        onPlaceUpdated={isOwner ? handlePlaceUpdated : undefined}
        onPlaceDeleted={isOwner ? handlePlaceDeleted : undefined}
      />
      <CityModal city={selectedCity} onClose={() => setSelectedCity(null)} />

      {addCityOpen && (
        <AddCityModal
          catalog={catalog}
          onClose={() => setAddCityOpen(false)}
          saveCity={userPostCity}
          onSaved={async () => {
            await loadCatalog();
            setAddCityOpen(false);
          }}
        />
      )}

      {addPlaceOpen && (
        <AddPlaceModal
          catalog={catalog}
          onClose={() => setAddPlaceOpen(false)}
          uploadPhotos={userUploadPhotos}
          onSaved={handlePlaceSaved}
        />
      )}

      {addRouteOpen && (
        <AddRouteModal
          catalog={catalog}
          onClose={() => setAddRouteOpen(false)}
          saveRoute={userPostRoute}
          onSaved={async () => {
            await loadCatalog();
            setAddRouteOpen(false);
          }}
        />
      )}

      {managerOpen && (
        <ManagerModal
          routes={routes}
          catalog={catalog}
          onClose={() => setManagerOpen(false)}
          deleteRouteApi={userDeleteRoute}
          deleteCityApi={userDeleteCity}
          onRoutesChanged={() => void loadCatalog()}
          onCitiesChanged={() => void loadCatalog()}
          onDeletePlace={handlePlaceDeleted}
          onEditPlace={(place) => { setSelectedPlace(place); setManagerOpen(false); }}
        />
      )}
    </div>
  );
}
