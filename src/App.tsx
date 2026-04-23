import { useCallback, useMemo, useRef, useState } from 'react'
import { AddPlaceModal } from './components/AddPlaceModal'
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
import type { CategoryFilter, City, Place } from './data/types'
import { useAdminMode } from './hooks/useAdminMode'
import {
  loadAdminPlacesFromStorage,
  saveAdminPlacesToStorage,
} from './lib/adminLocalPlacesStorage'
import { parseAdminTokenFromLocation } from './lib/adminToken'
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
  const [addPlaceOpen, setAddPlaceOpen] = useState(false)
  const mapRef = useRef<WorldMapRef>(null)
  const adminMode = useAdminMode()

  const catalogMerged = useMemo(
    () => mergeCatalogWithAdminPlaces(catalog, extraPlaces),
    [extraPlaces],
  )

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
    setExtraPlaces((prev) => {
      const next = [...prev, place]
      saveAdminPlacesToStorage(next)
      return next
    })
    const api = adminPlacesApiUrlFromEnv()
    const token = parseAdminTokenFromLocation()
    if (api && token) {
      const r = await submitAdminPlaceToApi(api, token, place)
      if (!r.ok) {
        window.alert(
          `Место сохранено в этом браузере (localStorage), но сервер ответил ошибкой:\n${r.message}`,
        )
      }
    }
  }, [])

  return (
    <div className="app">
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
        <h1 className="app-title">ffhoreca</h1>
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
