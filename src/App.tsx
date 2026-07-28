import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AddCityModal } from './components/AddCityModal'
import { AddPlaceModal } from './components/AddPlaceModal'
import { AddRouteModal } from './components/AddRouteModal'
import { ManagerModal } from './components/ManagerModal'
import { CategoryTabs } from './components/CategoryTabs'
import { CityModal } from './components/CityModal'
import { MapSearchBar } from './components/MapSearchBar'
import { PlaceModal } from './components/PlaceModal'
import { WorldMap, type WorldMapRef } from './components/WorldMap'
import { catalog } from './data/catalog'
import {
  mergeCatalogWithAdminPlaces,
  placesForFilter,
} from './data/selectors'
import type { Catalog, CategoryFilter, City, Place, TravelRoute } from './data/types'
import { fetchRoutes } from './lib/apiRoutes'
import { useAdminMode } from './hooks/useAdminMode'
import { useAppSplash } from './hooks/useAppSplash'
import { LoadingLetterSplash } from './components/LoadingLetterSplash'
import { apiBaseUrl } from './lib/apiBase'
import {
  loadAdminPlacesFromStorage,
  saveAdminPlacesToStorage,
} from './lib/adminLocalPlacesStorage'
import { fetchCatalogFromApi } from './lib/fetchCatalog'
import {
  adminPlacesApiUrlFromEnv,
  deleteAdminPlaceFromApi,
  submitAdminPlaceToApi,
} from './lib/submitAdminPlace'
import {
  loadDeletedPlaceIds,
  saveDeletedPlaceIds,
} from './lib/adminDeletedPlaceIdsStorage'
import { AppHeader } from './components/AppHeader'
import { AppFooter } from './components/AppFooter'
import { MapEditorActions } from './components/MapEditorActions'
import { useCanEditMap } from './hooks/useCanEditMap'
import { AuthButton } from './components/AuthButton'
import { FavoritesModal } from './components/FavoritesModal'
import { AdminUsersModal } from './components/AdminUsersModal'
import { AccountModal } from './components/AccountModal'
import { useAlert } from './components/AlertProvider'
import { MapOnboarding } from './components/MapOnboarding'
import { OnboardingHelpControls } from './components/OnboardingHelpControls'
import { useMapOnboarding } from './hooks/useMapOnboarding'
import { useCurrentUser } from './hooks/useCurrentUser'
import { useT } from './i18n/LocaleContext'
import { useToast } from './components/ToastProvider'
import { consumeAuthBootstrapError } from './lib/bootstrapAuth'
import './App.css'

const EMPTY_CATALOG: Catalog = { cities: [], places: [] }

function App() {
  const t = useT()
  const navigate = useNavigate()
  const { push: pushToast } = useToast()
  const apiConfiguredAtInit = apiBaseUrl() !== ''

  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [extraPlaces, setExtraPlaces] = useState<Place[]>(() =>
    apiConfiguredAtInit ? [] : loadAdminPlacesFromStorage(),
  )
  const [deletedPlaceIds, setDeletedPlaceIds] = useState<Set<string>>(() =>
    apiConfiguredAtInit ? new Set() : loadDeletedPlaceIds(),
  )
  const [remoteCatalog, setRemoteCatalog] = useState<Catalog | null>(null)
  const [catalogLoadError, setCatalogLoadError] = useState(false)
  const [routesLoadError, setRoutesLoadError] = useState(false)
  const [addCityOpen, setAddCityOpen] = useState(false)
  const [addPlaceOpen, setAddPlaceOpen] = useState(false)
  const [addRouteOpen, setAddRouteOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [userRoutes, setUserRoutes] = useState<TravelRoute[]>([])
  const [routesLoaded, setRoutesLoaded] = useState(!apiConfiguredAtInit)
  const mapRef = useRef<WorldMapRef>(null)
  const { user: currentUser, loading: authLoading, logout: handleLogout, refetch: refetchUser } = useCurrentUser()
  const { showAlert } = useAlert()
  const adminMode = useAdminMode(currentUser?.email)
  const canEditShowcase = useCanEditMap()
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [adminUsersOpen, setAdminUsersOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const onboardingEnabled = !adminMode
  const onboarding = useMapOnboarding(onboardingEnabled)
  const { notify: onboardingNotify, setTourOpen } = onboarding

  // First-time users: open account modal to pick a username
  useEffect(() => {
    if (currentUser && !currentUser.username && !authLoading) {
      setAccountOpen(true)
    }
  }, [currentUser, authLoading])

  useEffect(() => {
    const code = consumeAuthBootstrapError()
    if (!code) return
    const known = [
      'exchange_failed',
      'invalid_state',
      'no_code',
      'not_configured',
      'server_error',
    ] as const
    const key = (known as readonly string[]).includes(code)
      ? `auth.error.${code}`
      : 'auth.error.generic'
    pushToast(t(key), 'error')
  }, [pushToast, t])

  const apiConfigured = apiBaseUrl() !== ''

  useEffect(() => {
    if (!apiConfigured) return
    let cancelled = false
    void fetchCatalogFromApi()
      .then((c) => {
        if (!cancelled) {
          setRemoteCatalog(c)
          setCatalogLoadError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setCatalogLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [apiConfigured])

  useEffect(() => {
    if (!apiConfigured) return
    let cancelled = false
    void fetchRoutes()
      .then((routes) => {
        if (!cancelled) {
          setUserRoutes(routes)
          setRoutesLoadError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUserRoutes([])
          setRoutesLoadError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setRoutesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [apiConfigured])

  const dataReady =
    !apiConfigured ||
    ((remoteCatalog !== null || catalogLoadError) && routesLoaded)

  const { visible: splashVisible, onAnimationComplete } = useAppSplash(dataReady)

  /**
   * Если задан VITE_API_BASE_URL — единственный источник данных: ответ GET /api/catalog.
   * Встроенный catalog.ts и localStorage не подмешиваются (ни при загрузке, ни при ошибке).
   */
  const catalogMerged = useMemo(() => {
    if (!apiConfigured) {
      let merged = mergeCatalogWithAdminPlaces(catalog, extraPlaces)
      if (deletedPlaceIds.size > 0) {
        merged = {
          ...merged,
          places: merged.places.filter((p) => !deletedPlaceIds.has(p.id)),
        }
      }
      return merged
    }
    if (remoteCatalog) return remoteCatalog
    return EMPTY_CATALOG
  }, [apiConfigured, remoteCatalog, extraPlaces, deletedPlaceIds])

  const visiblePlaces = useMemo(
    () => placesForFilter(catalogMerged, filter),
    [catalogMerged, filter],
  )

  const flyToOnMap = useCallback((lng: number, lat: number) => {
    mapRef.current?.flyToLngLat(lng, lat)
  }, [])

  const openPlace = useCallback((place: Place) => {
    setSelectedCity(null)
    setSelectedPlace(place)
    onboardingNotify('placeOpened')
  }, [onboardingNotify])

  const openCity = useCallback((city: City) => {
    setSelectedPlace(null)
    setSelectedCity(city)
  }, [])

  const persistPlaceToBackendOrStorage = useCallback(
    async (place: Place, city?: City): Promise<{ ok: boolean; message?: string }> => {
      const base = apiBaseUrl();
      const postUrl =
        adminPlacesApiUrlFromEnv() ||
        (base ? `${base}/api/places` : '');

      const mergeLocal = () => {
        setExtraPlaces((prev) => {
          const idx = prev.findIndex((x) => x.id === place.id);
          const next =
            idx >= 0
              ? prev.map((x, i) => (i === idx ? place : x))
              : [...prev, place];
          saveAdminPlacesToStorage(next);
          return next;
        });
      };

      if (postUrl && adminMode) {
        const r = await submitAdminPlaceToApi(postUrl, '', place, city);
        if (r.ok) {
          if (base) {
            try {
              setRemoteCatalog(await fetchCatalogFromApi());
            } catch {
              /* оставляем старый remoteCatalog */
            }
          }
          return { ok: true };
        }
        showAlert(
          apiConfigured
            ? `${t('app.alertPlaceRejected')}\n${r.message}`
            : `${t('app.alertPlaceRejected')}\n${r.message}\n\n${t('app.alertPlaceRejectedLocal')}`,
        );
        if (!apiConfigured) mergeLocal();
        return { ok: false, message: r.message };
      }

      if (!apiConfigured) {
        mergeLocal();
        return { ok: true };
      }

      return { ok: false, message: t('app.errorMissingApiOrToken') };
    },
    [apiConfigured, t, adminMode, showAlert],
  );

  const handlePlaceDeleted = useCallback(
    async (placeId: string): Promise<boolean> => {
      const base = apiBaseUrl()
      const postUrl =
        adminPlacesApiUrlFromEnv() ||
        (base ? `${base}/api/places` : '')

      if (postUrl && adminMode) {
        const r = await deleteAdminPlaceFromApi(postUrl, '', placeId)
        if (r.ok) {
          if (base) {
            try {
              setRemoteCatalog(await fetchCatalogFromApi())
            } catch {
              /* ignore */
            }
          }
          return true
        }
        showAlert(
          `${t('app.alertPlaceDeleteFailed')}\n${r.message}`,
        )
        return false
      }

      if (!apiConfigured) {
        setDeletedPlaceIds((prev) => {
          const next = new Set(prev)
          next.add(placeId)
          saveDeletedPlaceIds(next)
          return next
        })
        setExtraPlaces((prev) => {
          const next = prev.filter((p) => p.id !== placeId)
          saveAdminPlacesToStorage(next)
          return next
        })
        return true
      }

      showAlert(t('app.errorMissingApiOrToken'))
      return false
    },
    [apiConfigured, t, adminMode, showAlert],
  )

  const handlePlaceUpdatedFromModal = useCallback(
    async (place: Place) => {
      const r = await persistPlaceToBackendOrStorage(place);
      if (r.ok) {
        setSelectedPlace(place);
      } else {
        if (r.message) showAlert(r.message);
        throw new Error(r.message || 'Save failed');
      }
    },
    [persistPlaceToBackendOrStorage, showAlert],
  );

  return (
    <div className={`app${splashVisible ? ' app--splash' : ''}`}>
      {splashVisible ? (
        <LoadingLetterSplash onAnimationComplete={onAnimationComplete} />
      ) : null}
      <div className="app-content" aria-hidden={splashVisible}>
      {catalogLoadError && apiConfigured ? (
        <p className="app-banner app-banner--warn" role="alert">
          {t('app.catalogLoadError')}
        </p>
      ) : null}
      {routesLoadError && apiConfigured ? (
        <p className="app-banner app-banner--warn" role="alert">
          {t('app.routesLoadError')}
        </p>
      ) : null}

      <AppHeader
        leftBelow={
          onboardingEnabled ? (
            <OnboardingHelpControls onOpenTour={() => setTourOpen(true)} />
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
        mode="showcase"
        canEdit={canEditShowcase}
        catalog={catalogMerged}
        routes={userRoutes}
        isLoggedIn={!!currentUser}
        username={currentUser?.username}
        onAddCity={() => setAddCityOpen(true)}
        onboarding={onboarding}
        hideHelpControls
      />

      <CategoryTabs value={filter} onChange={setFilter} />

      {canEditShowcase ? (
        <MapEditorActions
          onAddCity={() => setAddCityOpen(true)}
          onAddPlace={() => setAddPlaceOpen(true)}
          onAddRoute={() => setAddRouteOpen(true)}
          onOpenManager={() => setManagerOpen(true)}
        />
      ) : null}

      <MapSearchBar
        catalog={catalogMerged}
        onFlyTo={flyToOnMap}
        onSearchSelect={() => onboardingNotify('searchUsed')}
      />

      <WorldMap
        ref={mapRef}
        catalog={catalogMerged}
        filter={filter}
        places={visiblePlaces}
        userRoutes={userRoutes}
        onPlaceClick={openPlace}
        onCityClick={openCity}
        loading={!dataReady}
      />

      <PlaceModal
        key={selectedPlace?.id ?? 'closed'}
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        adminMode={adminMode}
        onPlaceUpdated={adminMode ? handlePlaceUpdatedFromModal : undefined}
        onPlaceDeleted={adminMode ? handlePlaceDeleted : undefined}
      />
      <CityModal city={selectedCity} onClose={() => setSelectedCity(null)} />
      {addCityOpen ? (
        <AddCityModal
          catalog={catalogMerged}
          onClose={() => setAddCityOpen(false)}
          onSaved={async () => {
            if (apiConfigured) {
              try {
                setRemoteCatalog(await fetchCatalogFromApi())
              } catch {
                /* оставляем старый remoteCatalog */
              }
            }
            onboardingNotify('cityAdded')
          }}
        />
      ) : null}
      {addPlaceOpen ? (
        <AddPlaceModal
          onClose={() => setAddPlaceOpen(false)}
          catalog={catalogMerged}
          onSaved={async (place, city) => {
            const r = await persistPlaceToBackendOrStorage(place, city)
            if (!r.ok) return false
            onboardingNotify('placeAdded')
            return true
          }}
        />
      ) : null}
      {managerOpen ? (
        <ManagerModal
          routes={userRoutes}
          catalog={catalogMerged}
          onClose={() => setManagerOpen(false)}
          onRoutesChanged={() => {
            void fetchRoutes().then((r) => setUserRoutes(r)).catch(() => {})
          }}
          onCitiesChanged={() => {
            if (!apiConfigured) return
            void fetchCatalogFromApi()
              .then((c) => setRemoteCatalog(c))
              .catch(() => {})
          }}
          onDeletePlace={handlePlaceDeleted}
          onEditPlace={(place) => { setSelectedPlace(place); }}
        />
      ) : null}
      {addRouteOpen ? (
        <AddRouteModal
          catalog={catalogMerged}
          onClose={() => setAddRouteOpen(false)}
          onSaved={() => {
            void fetchRoutes().then((routes) => setUserRoutes(routes)).catch(() => {})
            onboardingNotify('routeAdded')
          }}
        />
      ) : null}
      {favoritesOpen && currentUser ? (
        <FavoritesModal
          currentUser={currentUser}
          onClose={() => setFavoritesOpen(false)}
          onOpenProfile={(username) => { setFavoritesOpen(false); navigate(`/${username}`); }}
        />
      ) : null}
      {adminUsersOpen && adminMode ? (
        <AdminUsersModal
          onClose={() => setAdminUsersOpen(false)}
          onOpenProfile={(username) => { setAdminUsersOpen(false); navigate(`/${username}`); }}
        />
      ) : null}
      {accountOpen && currentUser ? (
        <AccountModal
          user={currentUser}
          onClose={() => setAccountOpen(false)}
          onUserUpdated={(updated) => {
            void refetchUser()
            if (updated.username) navigate(`/${updated.username}`)
          }}
          onAccountDeleted={() => {
            setAccountOpen(false)
            void handleLogout()
            navigate('/')
          }}
        />
      ) : null}
      <AppFooter />
      </div>
    </div>
  )
}

export default App
