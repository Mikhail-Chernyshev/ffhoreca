import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { parseAdminTokenFromLocation } from './lib/adminToken'
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
import './App.css'

const EMPTY_CATALOG: Catalog = { cities: [], places: [] }

function App() {
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
  const [addPlaceOpen, setAddPlaceOpen] = useState(false)
  const [addRouteOpen, setAddRouteOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [userRoutes, setUserRoutes] = useState<TravelRoute[]>([])
  const [routesLoaded, setRoutesLoaded] = useState(!apiConfiguredAtInit)
  const mapRef = useRef<WorldMapRef>(null)
  const adminMode = useAdminMode()

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
        if (!cancelled) setUserRoutes(routes)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRoutesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [apiConfigured])

  const catalogBusy =
    apiConfigured && remoteCatalog === null && !catalogLoadError

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
  }, [])

  const openCity = useCallback((city: City) => {
    setSelectedPlace(null)
    setSelectedCity(city)
  }, [])

  const persistPlaceToBackendOrStorage = useCallback(
    async (place: Place, city?: City): Promise<{ ok: boolean; message?: string }> => {
      const token = parseAdminTokenFromLocation();
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

      if (postUrl && token) {
        const r = await submitAdminPlaceToApi(postUrl, token, place, city);
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
        window.alert(
          apiConfigured
            ? `Сервер не принял место:\n${r.message}`
            : `Сервер не принял место:\n${r.message}\n\nСохраняю копию в этом браузере (localStorage).`,
        );
        if (!apiConfigured) mergeLocal();
        return { ok: false, message: r.message };
      }

      if (!apiConfigured) {
        mergeLocal();
        return { ok: true };
      }

      return { ok: false, message: 'Нет URL API или токена админа в URL' };
    },
    [apiConfigured],
  );

  const handleAdminPlaceSaved = useCallback(
    async (place: Place, city: City) => {
      await persistPlaceToBackendOrStorage(place, city);
    },
    [persistPlaceToBackendOrStorage],
  );

  const handlePlaceDeleted = useCallback(
    async (placeId: string): Promise<boolean> => {
      const token = parseAdminTokenFromLocation()
      const base = apiBaseUrl()
      const postUrl =
        adminPlacesApiUrlFromEnv() ||
        (base ? `${base}/api/places` : '')

      if (postUrl && token) {
        const r = await deleteAdminPlaceFromApi(postUrl, token, placeId)
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
        window.alert(
          apiConfigured
            ? `Не удалось удалить место:\n${r.message}`
            : `Не удалось удалить место:\n${r.message}`,
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

      window.alert('Нет URL API или токена админа в URL')
      return false
    },
    [apiConfigured],
  )

  const handlePlaceUpdatedFromModal = useCallback(
    async (place: Place) => {
      const r = await persistPlaceToBackendOrStorage(place);
      if (r.ok) {
        setSelectedPlace(place);
      } else if (r.message) {
        window.alert(r.message);
      }
    },
    [persistPlaceToBackendOrStorage],
  );

  return (
    <div className={`app${splashVisible ? ' app--splash' : ''}`}>
      {splashVisible ? (
        <LoadingLetterSplash onAnimationComplete={onAnimationComplete} />
      ) : null}
      <div className="app-content" aria-hidden={splashVisible}>
      {catalogBusy && !splashVisible ? (
        <p className="app-banner" role="status">
          Загрузка каталога с сервера…
        </p>
      ) : null}
      {catalogLoadError && apiConfigured ? (
        <p className="app-banner app-banner--warn" role="alert">
          Не удалось загрузить каталог с API. Данные из репозитория не подставляются — проверьте
          сеть, CORS и URL в VITE_API_BASE_URL.
        </p>
      ) : null}

      {adminMode ? (
        <div className="app-admin-actions">
          <button type="button" className="app-admin-add" onClick={() => setAddPlaceOpen(true)}>
            + Место
          </button>
          <button type="button" className="app-admin-add" onClick={() => setAddRouteOpen(true)}>
            + Маршрут
          </button>
          <button type="button" className="app-admin-add" onClick={() => setManagerOpen(true)}>
            ☰ Список
          </button>
        </div>
      ) : null}

      <header className="app-header">
        <h1 className="app-title">Tips from trips</h1>
        <p className="app-tagline">
          Места, где мы были: отели, гостевые, бары и рестораны по миру
        </p>
      </header>

      <CategoryTabs value={filter} onChange={setFilter} />

      <MapSearchBar catalog={catalogMerged} onFlyTo={flyToOnMap} />

      <WorldMap
        ref={mapRef}
        catalog={catalogMerged}
        filter={filter}
        places={visiblePlaces}
        userRoutes={userRoutes}
        onPlaceClick={openPlace}
        onCityClick={openCity}
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
      {addPlaceOpen ? (
        <AddPlaceModal
          onClose={() => setAddPlaceOpen(false)}
          catalog={catalogMerged}
          onSaved={handleAdminPlaceSaved}
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
          }}
        />
      ) : null}
      </div>
    </div>
  )
}

export default App
