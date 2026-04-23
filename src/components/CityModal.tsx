import { useCallback, useEffect } from 'react'
import countries from 'i18n-iso-countries'
import ru from 'i18n-iso-countries/langs/ru.json'
import type { City } from '../data/types'
import { ModalPhotoCarousel } from './PlaceModal'

countries.registerLocale(ru)

function countryNameRu(code: string): string {
  return countries.getName(code, 'ru') ?? code
}

type Props = {
  city: City | null
  onClose: () => void
}

export function CityModal({ city, onClose }: Props) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!city) return
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [city, onKey])

  if (!city) return null

  const photos = city.photos ?? []
  const hasPhotos = photos.length > 0
  const country = countryNameRu(city.countryCode)
  const coords = `${city.lat.toFixed(4)}°, ${city.lng.toFixed(4)}°`
  const hasSummary = Boolean(city.summary?.trim())
  const hasStory = Boolean(city.story?.trim())

  return (
    <div
      className="modal-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-modal-title"
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <h2 id="city-modal-title" className="modal-title">
          {city.name}
        </h2>
        <p className="modal-address">
          {country} · {coords}
        </p>

        {hasSummary ? (
          <p className="modal-summary">{city.summary}</p>
        ) : (
          <p className="modal-summary modal-summary--muted">
            Описание можно добавить в каталоге: поля <code className="modal-inline-code">summary</code> и{' '}
            <code className="modal-inline-code">story</code> у города.
          </p>
        )}

        {hasPhotos && <ModalPhotoCarousel key={city.id} photos={photos} />}

        {hasStory ? (
          <div className="modal-story">
            <h3 className="modal-story__heading">Заметки</h3>
            <p className="modal-story__text">{city.story}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
