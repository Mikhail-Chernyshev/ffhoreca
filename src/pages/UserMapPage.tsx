import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
import { useCanEditMap } from '../hooks/useCanEditMap';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { MapEditorActions } from '../components/MapEditorActions';
import { AppHeader } from '../components/AppHeader';
import { AuthButton } from '../components/AuthButton';
import { FavoritesModal } from '../components/FavoritesModal';
import { UsernameModal } from '../components/UsernameModal';
import { MapOnboarding } from '../components/MapOnboarding';
import { OnboardingHelpControls } from '../components/OnboardingHelpControls';
import { useMapOnboarding } from '../hooks/useMapOnboarding';

const EMPTY_CATALOG: Catalog = { cities: [], places: [] };

export function UserMapPage() {
  const { username } = useParams<{ username: string }>();
  const t = useT();
  const navigate = useNavigate();
  const { user: currentUser, loading: authLoading, logout: handleLogout, refetch: refetchUser } = useCurrentUser();
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [routes, setRoutes] = useState<TravelRoute[]>([]);
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

  const canEditMap = useCanEditMap(username);
  const mapMode = canEditMap ? 'ownMap' as const : 'sharedMap' as const;
  const onboarding = useMapOnboarding(mapMode !== 'sharedMap');
  const { notify: onboardingNotify, setTourOpen, skipAll, skipped } = onboarding;

  useEffect(() => {
    if (currentUser && !currentUser.username && !authLoading) {
      setShowUsernameModal(true);
    }
  }, [currentUser, authLoading]);

  const base = apiBaseUrl();

  const loadCatalog = useCallback(async () => {
    if (!base || !username) return;
    const headers = canEditMap ? authHeaders() : {};
    try {
      const [cat, rts] = await Promise.all([
        fetch(`${base}/api/users/${username}/catalog`, { headers }).then((r) => r.json()),
        fetch(`${base}/api/users/${username}/routes`, { headers }).then((r) => r.json()),
      ]);
      setCatalog(cat as Catalog);
      setRoutes((rts as TravelRoute[]) ?? []);
    } catch { /* ignore, stale data stays */ }
  }, [base, username, canEditMap]);

  useEffect(() => {
    if (!base || !username) return;
    setLoading(true);
    setNotFound(false);

    fetch(`${base}/api/users/${username}`)
      .then((r) => r.json())
      .then((data) => {
        const d = data as { error?: string };
        if (d.error) { setNotFound(true); return; }
        return loadCatalog();
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [base, username, loadCatalog]);

  const flyToOnMap = useCallback((lng: number, lat: number) => {
    mapRef.current?.flyToLngLat(lng, lat);
  }, []);

  const handlePlaceClick = useCallback((place: Place) => {
    setSelectedPlace(place);
    onboardingNotify('placeOpened');
  }, [onboardingNotify]);

  const visiblePlaces = useMemo(() => placesForFilter(catalog, filter), [catalog, filter]);

  // ---- Owner place handlers ----

  const handlePlaceSaved = useCallback(async (place: Place, city: City) => {
    const r = await userPostPlace(place, city);
    if (!r.ok) { window.alert(r.message); return; }
    await loadCatalog();
    onboardingNotify('placeAdded');
  }, [loadCatalog, onboardingNotify]);

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
      <AppHeader
        leftBelow={
          mapMode !== 'sharedMap' ? (
            <OnboardingHelpControls
              onOpenTour={() => setTourOpen(true)}
              onSkip={skipAll}
              showSkip={canEditMap && !skipped}
            />
          ) : null
        }
        tagline={t('app.tagline')}
        right={
          <AuthButton
            user={currentUser}
            loading={authLoading}
            onLogout={handleLogout}
            onOpenFavorites={() => setFavoritesOpen(true)}
          />
        }
      />

      <MapOnboarding
        mode={mapMode}
        canEdit={canEditMap}
        catalog={catalog}
        routes={routes}
        isLoggedIn={!!currentUser}
        username={currentUser?.username}
        profileUsername={username}
        onAddCity={() => setAddCityOpen(true)}
        onboarding={onboarding}
        hideHelpControls
      />

      <CategoryTabs value={filter} onChange={setFilter} />

      {canEditMap ? (
        <MapEditorActions
          onAddCity={() => setAddCityOpen(true)}
          onAddPlace={() => setAddPlaceOpen(true)}
          onAddRoute={() => setAddRouteOpen(true)}
          onOpenManager={() => setManagerOpen(true)}
        />
      ) : null}

      <MapSearchBar
        catalog={catalog}
        onFlyTo={flyToOnMap}
        onSearchSelect={() => onboardingNotify('searchUsed')}
      />

      <WorldMap
        ref={mapRef}
        catalog={catalog}
        filter={filter}
        places={visiblePlaces}
        userRoutes={routes}
        onPlaceClick={handlePlaceClick}
        onCityClick={setSelectedCity}
      />

      <PlaceModal
        key={selectedPlace?.id ?? 'closed'}
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        adminMode={canEditMap}
        onPlaceUpdated={canEditMap ? handlePlaceUpdated : undefined}
        onPlaceDeleted={canEditMap ? handlePlaceDeleted : undefined}
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
            onboardingNotify('cityAdded');
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
            onboardingNotify('routeAdded');
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

      {showUsernameModal && currentUser ? (
        <UsernameModal
          user={currentUser}
          onSave={(updated) => {
            void refetchUser();
            setShowUsernameModal(false);
            if (updated.username) navigate(`/${updated.username}`);
          }}
          onSkip={() => setShowUsernameModal(false)}
        />
      ) : null}

      {favoritesOpen && currentUser ? (
        <FavoritesModal
          currentUser={currentUser}
          onClose={() => setFavoritesOpen(false)}
          onOpenProfile={(uname) => { setFavoritesOpen(false); navigate(`/${uname}`); }}
        />
      ) : null}
    </div>
  );
}
