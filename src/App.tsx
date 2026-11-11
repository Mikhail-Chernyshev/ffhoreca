import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  countedCountryCodes,
  mergeCatalogWithAdminPlaces,
  placesForFilter,
} from './data/selectors'
import {
  SHOWCASE_DEFAULT_TRANSIT,
  toggleTransitCode,
  transitSet,
} from './lib/transitCountries'
import { fetchShowcaseTransit, patchShowcaseTransit } from './lib/apiTransit'
import { worldCoveragePercent } from './lib/travelPassport'
import type { Catalog, CategoryFilter, City, Place } from './data/types'
import { postCity } from './lib/apiCities'
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
import { queryKeys } from './lib/queryKeys'
import {
  adminPlacesApiUrlFromEnv,
  deleteAdminPlaceFromApi,
  submitAdminPlaceToApi,
} from './lib/submitAdminPlace'
import {
  loadDeletedPlaceIds,
  saveDeletedPlaceIds,
} from './lib/adminDeletedPlaceIdsStorage'
import { MapPageLayout } from './components/MapPageLayout'
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
import { useLocale, useT } from './i18n/LocaleContext'
import { PostcardModal } from './components/PostcardModal'
import { buildPostcardData } from './lib/postcard'
import { useToast } from './components/ToastProvider'
import { consumeAuthBootstrapError } from './lib/bootstrapAuth'

const EMPTY_CATALOG: Catalog = { cities: [], places: [] }

function App() {
  const t = useT()
  const { locale } = useLocale()
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
  const [addCityOpen, setAddCityOpen] = useState(false)
  const [addPlaceOpen, setAddPlaceOpen] = useState(false)
  const [addRouteOpen, setAddRouteOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [localTransit, setLocalTransit] = useState<string[]>(() => [
    ...SHOWCASE_DEFAULT_TRANSIT,
  ])
  const mapRef = useRef<WorldMapRef>(null)
  const transitBusy = useRef(false)
  const queryClient = useQueryClient()
  const { user: currentUser, loading: authLoading, logout: handleLogout, refetch: refetchUser } = useCurrentUser()
  const { showAlert } = useAlert()
  const adminMode = useAdminMode(currentUser?.email)
  const canEditShowcase = useCanEditMap()
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [adminUsersOpen, setAdminUsersOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [postcardOpen, setPostcardOpen] = useState(false)
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

  const catalogQuery = useQuery({
    queryKey: queryKeys.showcaseCatalog,
    queryFn: fetchCatalogFromApi,
    enabled: apiConfigured,
  })
  const routesQuery = useQuery({
    queryKey: queryKeys.showcaseRoutes,
    queryFn: fetchRoutes,
    enabled: apiConfigured,
  })
  const transitQuery = useQuery({
    queryKey: queryKeys.showcaseTransit,
    queryFn: fetchShowcaseTransit,
    enabled: apiConfigured,
  })

  const remoteCatalog = catalogQuery.data ?? null
  const catalogLoadError = catalogQuery.isError
  const userRoutes = routesQuery.data ?? []
  const routesLoadError = routesQuery.isError
  const routesLoaded = !apiConfigured || routesQuery.isFetched

  const refreshShowcaseCatalog = useCallback(async () => {
    if (!apiConfigured) return
    await queryClient.invalidateQueries({ queryKey: queryKeys.showcaseCatalog })
  }, [apiConfigured, queryClient])

  const refreshShowcaseRoutes = useCallback(async () => {
    if (!apiConfigured) return
    await queryClient.invalidateQueries({ queryKey: queryKeys.showcaseRoutes })
  }, [apiConfigured, queryClient])

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
  const transitCodes = useMemo(
    () =>
      apiConfigured
        ? (transitQuery.data ?? SHOWCASE_DEFAULT_TRANSIT)
        : localTransit,
    [apiConfigured, transitQuery.data, localTransit],
  )
  const transitCountries = useMemo(() => transitSet(transitCodes), [transitCodes])
  const countryCount = useMemo(
    () => countedCountryCodes(catalogMerged, transitCountries).size,
    [catalogMerged, transitCountries],
  )
  const worldPercent = worldCoveragePercent(countryCount)
  const postcardData = useMemo(() => {
    if (countryCount === 0) return null
    const base = import.meta.env.BASE_URL.replace(/\/+$/, '') || ''
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return buildPostcardData({
      name: 'Tips from trips',
      username: null,
      catalog: catalogMerged,
      routes: routesQuery.data ?? [],
      transit: transitCountries,
      locale,
      mapUrl: `${origin}${base}/`,
    })
  }, [catalogMerged, countryCount, locale, routesQuery.data, transitCountries])

  const handleToggleTransit = useCallback(
    async (code: string) => {
      if (transitBusy.current) return
      transitBusy.current = true
      const prev = transitCodes
      const next = toggleTransitCode(prev, code)
      if (!apiConfigured) {
        setLocalTransit(next)
        transitBusy.current = false
        return
      }
      queryClient.setQueryData(queryKeys.showcaseTransit, next)
      try {
        const saved = await patchShowcaseTransit(next)
        queryClient.setQueryData(queryKeys.showcaseTransit, saved)
      } catch (e) {
        queryClient.setQueryData(queryKeys.showcaseTransit, prev)
        showAlert(
          t('placeModal.alertGenericError', {
            message: e instanceof Error ? e.message : String(e),
          }),
        )
      } finally {
        transitBusy.current = false
      }
    },
    [apiConfigured, transitCodes, queryClient, showAlert, t],
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
          if (base) await refreshShowcaseCatalog();
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
    [apiConfigured, t, adminMode, showAlert, refreshShowcaseCatalog],
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
          if (base) await refreshShowcaseCatalog()
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
    [apiConfigured, t, adminMode, showAlert, refreshShowcaseCatalog],
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

  const handleCityUpdatedFromModal = useCallback(
    async (city: City) => {
      const r = await postCity(city)
      if (r.ok) {
        await refreshShowcaseCatalog()
        setSelectedCity(city)
      } else {
        if (r.message) showAlert(r.message)
        throw new Error(r.message || 'Save failed')
      }
    },
    [refreshShowcaseCatalog, showAlert],
  );

  return (
    <MapPageLayout
      splashActive={splashVisible}
      splash={
        splashVisible ? (
          <LoadingLetterSplash onAnimationComplete={onAnimationComplete} />
        ) : null
      }
      headerLeftBelow={
        onboardingEnabled ? (
          <OnboardingHelpControls onOpenTour={() => setTourOpen(true)} />
        ) : null
      }
      headerRight={
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
      tools={
        <>
          <MapSearchBar
            catalog={catalogMerged}
            onFlyTo={flyToOnMap}
            onSearchSelect={() => onboardingNotify('searchUsed')}
          />
          <CategoryTabs
            value={filter}
            onChange={setFilter}
            catalog={catalogMerged}
            routes={userRoutes}
          />
          {postcardData ? (
            <button
              type="button"
              className="map-passport nums-tabular"
              onClick={() => setPostcardOpen(true)}
              aria-label={t('postcard.openAria', { percent: worldPercent })}
            >
              {t('userMap.passportChip', { percent: worldPercent })}
            </button>
          ) : null}
          {canEditShowcase ? (
            <MapEditorActions
              onAddCity={() => setAddCityOpen(true)}
              onAddPlace={() => setAddPlaceOpen(true)}
              onAddRoute={() => setAddRouteOpen(true)}
              onOpenManager={() => setManagerOpen(true)}
            />
          ) : (
            <div className="app-admin-actions">
              <button
                type="button"
                className="app-admin-add"
                onClick={() => setManagerOpen(true)}
              >
                {t('userMap.openList')}
              </button>
            </div>
          )}
        </>
      }
      notices={
        <>
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
        </>
      }
      map={
        <div className="map-shell">
          <WorldMap
            ref={mapRef}
            catalog={catalogMerged}
            filter={filter}
            places={visiblePlaces}
            userRoutes={userRoutes}
            onPlaceClick={openPlace}
            onCityClick={openCity}
            loading={!dataReady}
            transitCountries={transitCountries}
          />
        </div>
      }
    >
      <PlaceModal
        key={selectedPlace?.id ?? 'closed'}
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
        adminMode={adminMode}
        onPlaceUpdated={adminMode ? handlePlaceUpdatedFromModal : undefined}
        onPlaceDeleted={adminMode ? handlePlaceDeleted : undefined}
      />
      <CityModal
        city={selectedCity}
        onClose={() => setSelectedCity(null)}
        canEdit={adminMode}
        onCityUpdated={adminMode ? handleCityUpdatedFromModal : undefined}
      />
      {addCityOpen ? (
        <AddCityModal
          catalog={catalogMerged}
          onClose={() => setAddCityOpen(false)}
          onSaved={async () => {
            await refreshShowcaseCatalog()
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
          readOnly={!canEditShowcase}
          routes={userRoutes}
          catalog={catalogMerged}
          onClose={() => setManagerOpen(false)}
          onRoutesChanged={canEditShowcase ? () => {
            void refreshShowcaseRoutes()
          } : undefined}
          onCitiesChanged={canEditShowcase ? () => {
            void refreshShowcaseCatalog()
          } : undefined}
          onDeletePlace={canEditShowcase ? handlePlaceDeleted : undefined}
          onEditPlace={(place) => { setSelectedPlace(place); }}
          onShowOnMap={(lng, lat) => {
            setFilter('all')
            flyToOnMap(lng, lat)
          }}
          transitCountries={transitCountries}
          onToggleTransit={
            canEditShowcase || !apiConfigured ? handleToggleTransit : undefined
          }
        />
      ) : null}
      {addRouteOpen ? (
        <AddRouteModal
          catalog={catalogMerged}
          onClose={() => setAddRouteOpen(false)}
          savePlace={async (place, city) => {
            const r = await persistPlaceToBackendOrStorage(place, city)
            if (!r.ok) return { ok: false, message: r.message }
            onboardingNotify('placeAdded')
            return { ok: true }
          }}
          onSaved={() => {
            void refreshShowcaseRoutes()
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
      {postcardOpen && postcardData ? (
        <PostcardModal
          data={postcardData}
          onClose={() => setPostcardOpen(false)}
        />
      ) : null}
      {accountOpen && currentUser ? (
        <AccountModal
          user={currentUser}
          onClose={() => setAccountOpen(false)}
          onUserUpdated={(updated) => {
            void refetchUser()
            if (
              updated.username &&
              updated.username.toLowerCase() !== (currentUser.username ?? '').toLowerCase()
            ) {
              navigate(`/${updated.username}`)
            }
          }}
          onAccountDeleted={() => {
            setAccountOpen(false)
            void handleLogout()
            navigate('/')
          }}
        />
      ) : null}
    </MapPageLayout>
  )
}

export default App
