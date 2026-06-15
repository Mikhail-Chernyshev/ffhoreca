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
import { apiBaseUrl, apiFetch } from '../lib/apiBase';
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
import { AppFooter } from '../components/AppFooter';
import { AuthButton } from '../components/AuthButton';
import { FavoritesModal } from '../components/FavoritesModal';
import { AccountModal } from '../components/AccountModal';
import { MapRestrictedOverlay } from '../components/MapRestrictedOverlay';
import { MapOnboarding } from '../components/MapOnboarding';
import { OnboardingHelpControls } from '../components/OnboardingHelpControls';
import { useMapOnboarding } from '../hooks/useMapOnboarding';
import { useUserUsage } from '../hooks/useUserUsage';
import { useFreemiumWarnings } from '../hooks/useFreemiumWarnings';
import { useToast } from '../components/ToastProvider';
import { limitReachedMessage } from '../lib/limitMessages';
import type { AuthUser } from '../lib/apiAuth';
import type { UserSubscription } from '../data/subscription';
import type { UserApiResult } from '../lib/apiUserCatalog';

const EMPTY_CATALOG: Catalog = { cities: [], places: [] };

export function UserMapPage() {
  const { username } = useParams<{ username: string }>();
  const t = useT();
  const navigate = useNavigate();
  const { user: currentUser, loading: authLoading, logout: handleLogout, refetch: refetchUser } = useCurrentUser();
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [routes, setRoutes] = useState<TravelRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mapRestricted, setMapRestricted] = useState(false);
  const [profileUser, setProfileUser] = useState<AuthUser | null>(null);
  const [requiredSubscription, setRequiredSubscription] = useState<UserSubscription>('freemium');

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
  const { push: pushToast } = useToast();
  const { usage, refresh: refreshUsage } = useUserUsage(canEditMap);
  useFreemiumWarnings(currentUser?.subscription, usage);

  const handleUserApiError = useCallback((result: UserApiResult) => {
    if (result.limitReached && result.code) {
      pushToast(limitReachedMessage(t, result.code), 'error');
    }
  }, [pushToast, t]);

  useEffect(() => {
    if (currentUser && !currentUser.username && !authLoading) {
      setAccountOpen(true);
    }
  }, [currentUser, authLoading]);

  const base = apiBaseUrl();

  const loadCatalog = useCallback(async () => {
    if (!base || !username) return false;
    try {
      const [catRes, routesRes] = await Promise.all([
        apiFetch(`${base}/api/users/${username}/catalog`),
        apiFetch(`${base}/api/users/${username}/routes`),
      ]);
      if (catRes.status === 403 || routesRes.status === 403) {
        setMapRestricted(true);
        setCatalog(EMPTY_CATALOG);
        setRoutes([]);
        return false;
      }
      const [cat, rts] = await Promise.all([
        catRes.json(),
        routesRes.json(),
      ]);
      setCatalog(cat as Catalog);
      setRoutes((rts as TravelRoute[]) ?? []);
      return true;
    } catch {
      return false;
    }
  }, [base, username]);

  useEffect(() => {
    if (!base || !username) return;
    setLoading(true);
    setNotFound(false);
    setMapRestricted(false);
    setProfileUser(null);

    apiFetch(`${base}/api/users/${username}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await r.json() as {
          user?: AuthUser;
          map_access?: 'full' | 'restricted';
          required_subscription?: UserSubscription;
          error?: string;
        };
        if (!data.user) {
          setNotFound(true);
          return;
        }
        setProfileUser(data.user);
        const restricted = data.map_access === 'restricted';
        setMapRestricted(restricted);
        setRequiredSubscription(
          data.required_subscription === 'premium' ? 'premium' : 'freemium',
        );
        if (!restricted) {
          await loadCatalog();
        } else {
          setCatalog(EMPTY_CATALOG);
          setRoutes([]);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [base, username, currentUser?.id, loadCatalog]);

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
    if (!r.ok) {
      handleUserApiError(r);
      window.alert(r.message);
      return;
    }
    await loadCatalog();
    await refreshUsage();
    onboardingNotify('placeAdded');
  }, [loadCatalog, onboardingNotify, handleUserApiError, refreshUsage]);

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
            onOpenAccount={() => setAccountOpen(true)}
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

      <div className={mapRestricted ? 'map-shell map-shell--restricted' : 'map-shell'}>
        <WorldMap
          ref={mapRef}
          catalog={catalog}
          filter={filter}
          places={visiblePlaces}
          userRoutes={routes}
          onPlaceClick={handlePlaceClick}
          onCityClick={setSelectedCity}
        />
        {mapRestricted && profileUser ? (
          <MapRestrictedOverlay
            ownerName={profileUser.name}
            requiredSubscription={requiredSubscription}
            isLoggedIn={!!currentUser}
          />
        ) : null}
      </div>

      <PlaceModal
        key={selectedPlace?.id ?? 'closed'}
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        adminMode={canEditMap}
        onPlaceUpdated={canEditMap ? handlePlaceUpdated : undefined}
        onPlaceDeleted={canEditMap ? handlePlaceDeleted : undefined}
        reportOwnerUsername={!canEditMap && username ? username : undefined}
      />
      <CityModal city={selectedCity} onClose={() => setSelectedCity(null)} />

      {addCityOpen && (
        <AddCityModal
          catalog={catalog}
          onClose={() => setAddCityOpen(false)}
          saveCity={async (city) => {
            const r = await userPostCity(city);
            if (!r.ok) handleUserApiError(r);
            return r;
          }}
          onSaved={async () => {
            await loadCatalog();
            await refreshUsage();
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
          saveRoute={async (route) => {
            const r = await userPostRoute(route);
            if (!r.ok) handleUserApiError(r);
            return r;
          }}
          onSaved={async () => {
            await loadCatalog();
            await refreshUsage();
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

      {favoritesOpen && currentUser ? (
        <FavoritesModal
          currentUser={currentUser}
          onClose={() => setFavoritesOpen(false)}
          onOpenProfile={(uname) => { setFavoritesOpen(false); navigate(`/${uname}`); }}
        />
      ) : null}

      {accountOpen && currentUser ? (
        <AccountModal
          user={currentUser}
          onClose={() => setAccountOpen(false)}
          onUserUpdated={(updated) => {
            void refetchUser();
            void refreshUsage();
            if (updated.username) navigate(`/${updated.username}`);
          }}
        />
      ) : null}
      <AppFooter />
    </div>
  );
}
