import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddPlaceModal } from './components/AddPlaceModal'
import { CategoryTabs } from './components/CategoryTabs'
import { CityModal } from './components/CityModal'
import { MapSearchBar } from './components/MapSearchBar'
import { PlaceModal } from './components/PlaceModal'
import { WorldMap, type WorldMapRef } from './components/WorldMap'
import { catalog as catalogStatic } from './data/catalog'
import {
  mergeCatalogWithAdminPlaces,
  placesForFilter,
} from './data/selectors'
import type { Catalog, CategoryFilter, City, Place } from './data/types'
import { useAdminMode } from './hooks/useAdminMode'
import { apiBaseUrl } from './lib/apiBase'
import {
  loadAdminPlacesFromStorage,
  saveAdminPlacesToStorage,
} from './lib/adminLocalPlacesStorage'
import { parseAdminTokenFromLocation } from './lib/adminToken'
import { fetchCatalogFromApi } from './lib/fetchCatalog'
import {
  adminPlacesApiUrlFromEnv,
  submitAdminPlaceToApi,
} from './lib/submitAdminPlace'
import './App.css'

function App() {
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [selectedCity, setSelectedCity] = useState<City | null>(null)
  const [extraPlaces, setExtraPlaces] = useState<Place[]>(() =>
    loadAdminPlacesFromStorage(),
  )
  const [remoteCatalog, setRemoteCatalog] = useState<Catalog | null>(null)
  const [catalogLoadError, setCatalogLoadError] = useState(false)
  const [addPlaceOpen, setAddPlaceOpen] = useState(false)
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

  const catalogBusy =
    apiConfigured && remoteCatalog === null && !catalogLoadError

  const catalogMerged = useMemo(() => {
    if (remoteCatalog) return remoteCatalog
    return mergeCatalogWithAdminPlaces(catalogStatic, extraPlaces)
  }, [remoteCatalog, extraPlaces])

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

  const handleAdminPlaceSaved = useCallback(async (place: Place) => {
    const token = parseAdminTokenFromLocation()
    const base = apiBaseUrl()
    const postUrl =
      adminPlacesApiUrlFromEnv() ||
      (base ? `${base}/api/places` : '')

    if (postUrl && token) {
      const r = await submitAdminPlaceToApi(postUrl, token, place)
      if (r.ok) {
        if (base) {
          try {
            setRemoteCatalog(await fetchCatalogFromApi())
          } catch {
            /* оставляем старый remoteCatalog */
          }
        }
        return
      }
      window.alert(
        `Сервер не принял место:\n${r.message}\n\nСохраняю копию в этом браузере (localStorage).`,
      )
    }

    setExtraPlaces((prev) => {
      const next = [...prev, place]
      saveAdminPlacesToStorage(next)
      return next
    })
  }, [])

  return (
    <div className="app">
      {catalogBusy ? (
        <p className="app-banner" role="status">
          Загрузка каталога с сервера…
        </p>
      ) : null}
      {catalogLoadError && apiConfigured ? (
        <p className="app-banner app-banner--warn" role="alert">
          Не удалось загрузить каталог с API — показан встроенный каталог и локальные дополнения.
        </p>
      ) : null}

      {adminMode ? (
        <button
          type="button"
          className="app-admin-add"
          onClick={() => setAddPlaceOpen(true)}
        >
          Добавить
        </button>
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
        onPlaceClick={openPlace}
        onCityClick={openCity}
      />

      <PlaceModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
      <CityModal city={selectedCity} onClose={() => setSelectedCity(null)} />
      {addPlaceOpen ? (
        <AddPlaceModal
          onClose={() => setAddPlaceOpen(false)}
          catalog={catalogMerged}
          onSaved={handleAdminPlaceSaved}
        />
      ) : null}
    </div>
  )
}

export default App
