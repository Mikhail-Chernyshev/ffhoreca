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
import { AdminUsersModal } from '../components/AdminUsersModal';
import { AccountModal } from '../components/AccountModal';
import { MapRestrictedOverlay } from '../components/MapRestrictedOverlay';
import { useAlert } from '../components/AlertProvider';
import { MapOnboarding } from '../components/MapOnboarding';
import { OnboardingHelpControls } from '../components/OnboardingHelpControls';
import { useMapOnboarding } from '../hooks/useMapOnboarding';
import { useUserUsage } from '../hooks/useUserUsage';
import { useFreemiumWarnings } from '../hooks/useFreemiumWarnings';
import { useToast } from '../components/ToastProvider';
import { limitReachedMessage } from '../lib/limitMessages';
import { authHeaders, type AuthUser } from '../lib/apiAuth';
import type { UserApiResult } from '../lib/apiUserCatalog';
import { usePageMeta } from '../lib/pageMeta';
import { mapPageUrl } from '../lib/shareUrl';
import { useAdminMode } from '../hooks/useAdminMode';

const EMPTY_CATALOG: Catalog = { cities: [], places: [] };

export function UserMapPage() {
  const { username } = useParams<{ username: string }>();
  const t = useT();
  const navigate = useNavigate();
  const { user: currentUser, loading: authLoading, logout: handleLogout, refetch: refetchUser } = useCurrentUser();
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [adminUsersOpen, setAdminUsersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [routes, setRoutes] = useState<TravelRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mapRestricted, setMapRestricted] = useState(false);
  const [profileUser, setProfileUser] = useState<AuthUser | null>(null);

  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [addCityOpen, setAddCityOpen] = useState(false);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [addRouteOpen, setAddRouteOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  const mapRef = useRef<WorldMapRef>(null);

  const canEditMap = useCanEditMap(username);
  const adminMode = useAdminMode(currentUser?.email);
  const mapMode = canEditMap ? 'ownMap' as const : 'sharedMap' as const;
  const onboarding = useMapOnboarding(mapMode !== 'sharedMap');
  const { notify: onboardingNotify, setTourOpen, skipAll, skipped } = onboarding;
  const { push: pushToast } = useToast();
  const { showAlert } = useAlert();
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

  const loadCatalog = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!base || !username) return false;
    try {
      const headers = authHeaders();
      const [catRes, routesRes] = await Promise.all([
        apiFetch(`${base}/api/users/${username}/catalog`, { headers }),
        apiFetch(`${base}/api/users/${username}/routes`, { headers }),
      ]);
      if (signal?.cancelled) return false;
      if (catRes.status === 403 || routesRes.status === 403) {
        setMapRestricted(true);
        setCatalog(EMPTY_CATALOG);
        setRoutes([]);
        return false;
      }
      if (!catRes.ok || !routesRes.ok) {
        setCatalog(EMPTY_CATALOG);
        setRoutes([]);
        return false;
      }
      const [cat, rts] = await Promise.all([
        catRes.json() as Promise<unknown>,
        routesRes.json() as Promise<unknown>,
      ]);
      if (signal?.cancelled) return false;
      const cities = Array.isArray((cat as Catalog)?.cities) ? (cat as Catalog).cities : null;
      const places = Array.isArray((cat as Catalog)?.places) ? (cat as Catalog).places : null;
      if (!cities || !places) {
        setCatalog(EMPTY_CATALOG);
        setRoutes([]);
        return false;
      }
      setCatalog({ cities, places });
      setRoutes(Array.isArray(rts) ? (rts as TravelRoute[]) : []);
      return true;
    } catch {
      if (!signal?.cancelled) {
        setCatalog(EMPTY_CATALOG);
        setRoutes([]);
      }
      return false;
    }
  }, [base, username]);

  useEffect(() => {
    if (!base || !username) return;
    const signal = { cancelled: false };
    setLoading(true);
    setNotFound(false);
    setMapRestricted(false);
    setProfileUser(null);

    apiFetch(`${base}/api/users/${username}`, { headers: authHeaders() })
      .then(async (r) => {
        if (signal.cancelled) return;
        if (r.status === 404 || !r.ok) {
          setNotFound(true);
          return;
        }
        const data = await r.json() as {
          user?: AuthUser;
          map_access?: 'full' | 'restricted';
          error?: string;
        };
        if (signal.cancelled) return;
        if (!data.user) {
          setNotFound(true);
          return;
        }
        setProfileUser(data.user);
        const restricted = data.map_access === 'restricted';
        setMapRestricted(restricted);
        if (!restricted) {
          await loadCatalog(signal);
        } else {
          setCatalog(EMPTY_CATALOG);
          setRoutes([]);
        }
      })
      .catch(() => {
        if (!signal.cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!signal.cancelled) setLoading(false);
      });

    return () => {
      signal.cancelled = true;
    };
  }, [base, username, currentUser?.id, loadCatalog]);

  const flyToOnMap = useCallback((lng: number, lat: number) => {
    mapRef.current?.flyToLngLat(lng, lat);
  }, []);

  const handlePlaceClick = useCallback((place: Place) => {
    setSelectedPlace(place);
    onboardingNotify('placeOpened');
  }, [onboardingNotify]);

  const visiblePlaces = useMemo(() => placesForFilter(catalog, filter), [catalog, filter]);

  const pageMeta = useMemo(() => {
    if (!profileUser?.username || mapRestricted) return null;
    const un = profileUser.username;
    return {
      title: t('userMap.pageTitle', { username: un, name: profileUser.name }),
      description: t('userMap.pageDescription', {
        username: un,
        name: profileUser.name,
        cities: catalog.cities.length,
        places: catalog.places.length,
        routes: routes.length,
      }),
      url: mapPageUrl(un),
    };
  }, [profileUser, mapRestricted, catalog.cities.length, catalog.places.length, routes.length, t]);

  usePageMeta(pageMeta);

  // ---- Owner place handlers ----

  const persistPlace = useCallback(async (place: Place, city: City): Promise<boolean> => {
    const r = await userPostPlace(place, city);
    if (!r.ok) {
      handleUserApiError(r);
      showAlert(r.message);
      return false;
    }
    await loadCatalog();
    await refreshUsage();
    return true;
  }, [loadCatalog, handleUserApiError, refreshUsage, showAlert]);

  const handlePlaceSaved = useCallback(async (place: Place, city: City) => {
    const ok = await persistPlace(place, city);
    if (ok) onboardingNotify('placeAdded');
    return ok;
  }, [persistPlace, onboardingNotify]);

  const handlePlaceDeleted = useCallback(async (placeId: string): Promise<boolean> => {
    const r = await userDeletePlace(placeId);
    if (!r.ok) { showAlert(r.message); return false; }
    await loadCatalog();
    return true;
  }, [loadCatalog, showAlert]);

  const handlePlaceUpdated = useCallback(async (place: Place) => {
    const city = catalog.cities.find((c) => c.id === place.cityId);
    if (!city) throw new Error('City not found');
    const ok = await persistPlace(place, city);
    if (!ok) throw new Error('Save failed');
    setSelectedPlace(place);
  }, [persistPlace, catalog.cities]);

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
            isAdmin={adminMode}
            onOpenAdminUsers={() => setAdminUsersOpen(true)}
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
        onAddCity={() => setAddCityOpen(true)}
        onboarding={onboarding}
        hideHelpControls
      />

      <CategoryTabs value={filter} onChange={setFilter} catalog={catalog} />

      {canEditMap ? (
        <MapEditorActions
          onAddCity={() => setAddCityOpen(true)}
          onAddPlace={() => setAddPlaceOpen(true)}
          onAddRoute={() => setAddRouteOpen(true)}
          onOpenManager={() => setManagerOpen(true)}
        />
      ) : !mapRestricted ? (
        <div className="app-admin-actions">
          <button
            type="button"
            className="app-admin-add"
            onClick={() => setManagerOpen(true)}
          >
            {t('userMap.openList')}
          </button>
        </div>
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
          ownerUsername={username}
          isOwnMap={canEditMap && !!currentUser}
        />
        {mapRestricted && profileUser ? (
          <MapRestrictedOverlay
            ownerName={profileUser.name}
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
        uploadPhotos={canEditMap ? userUploadPhotos : undefined}
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
          readOnly={!canEditMap}
          routes={routes}
          catalog={catalog}
          onClose={() => setManagerOpen(false)}
          onEditPlace={(place) => setSelectedPlace(place)}
          onRoutesChanged={canEditMap ? () => void loadCatalog() : undefined}
          onCitiesChanged={canEditMap ? () => void loadCatalog() : undefined}
          onDeletePlace={canEditMap ? handlePlaceDeleted : undefined}
          deleteRouteApi={canEditMap ? userDeleteRoute : undefined}
          deleteCityApi={canEditMap ? userDeleteCity : undefined}
        />
      )}

      {favoritesOpen && currentUser ? (
        <FavoritesModal
          currentUser={currentUser}
          onClose={() => setFavoritesOpen(false)}
          onOpenProfile={(uname) => { setFavoritesOpen(false); navigate(`/${uname}`); }}
        />
      ) : null}

      {adminUsersOpen && adminMode ? (
        <AdminUsersModal
          onClose={() => setAdminUsersOpen(false)}
          onOpenProfile={(uname) => { setAdminUsersOpen(false); navigate(`/${uname}`); }}
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
          onAccountDeleted={() => {
            setAccountOpen(false);
            void handleLogout();
            navigate('/');
          }}
        />
      ) : null}
      <AppFooter />
    </div>
  );
}
