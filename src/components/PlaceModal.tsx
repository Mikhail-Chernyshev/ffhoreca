import { useCallback, useEffect, useState } from 'react'
import type { Place } from '../data/types'

type Props = {
  place: Place | null
  onClose: () => void
}

export function ModalPhotoCarousel({ photos }: { photos: string[] }) {
  const [photoIndex, setPhotoIndex] = useState(0)

  return (
    <div className="modal-carousel">
      <div className="modal-carousel__viewport">
        <img
          className="modal-carousel__img"
          src={photos[photoIndex]}
          alt=""
          width={900}
          height={560}
        />
      </div>
      {photos.length > 1 && (
        <div className="modal-carousel__controls">
          <button
            type="button"
            className="modal-carousel__btn"
            onClick={() =>
              setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)
            }
            aria-label="Предыдущее фото"
          >
            ‹
          </button>
          <span className="modal-carousel__counter">
            {photoIndex + 1} / {photos.length}
          </span>
          <button
            type="button"
            className="modal-carousel__btn"
            onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
            aria-label="Следующее фото"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}

export function PlaceModal({ place, onClose }: Props) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!place) return
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [place, onKey])

  if (!place) return null

  const photos = place.photos
  const hasPhotos = photos.length > 0
  const ratingLabel =
    place.googleRating != null ? `${place.googleRating.toFixed(1)} / 5` : '—'

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
        aria-labelledby="place-modal-title"
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <h2 id="place-modal-title" className="modal-title">
          {place.name}
        </h2>
        <p className="modal-address">{place.address}</p>
        <p className="modal-summary">{place.summary}</p>

        <p className="modal-rating">
          Оценка Google Maps: <strong>{ratingLabel}</strong>
        </p>

        {hasPhotos && <ModalPhotoCarousel key={place.id} photos={photos} />}

        <div className="modal-story">
          <h3 className="modal-story__heading">Наши впечатления</h3>
          <p className="modal-story__text">{place.story}</p>
        </div>
      </div>
    </div>
  )
}
