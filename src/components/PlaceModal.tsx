import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Place, PlaceCategory } from '../data/types'

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  lodging: 'Жильё',
  food: 'Еда',
  bar: 'Бары',
  airport: 'Аэропорты',
}

const CATEGORY_ORDER: PlaceCategory[] = ['lodging', 'food', 'bar', 'airport']

type Props = {
  place: Place | null;
  onClose: () => void;
  /** Редактирование оценки и текста впечатлений в режиме админа */
  adminMode?: boolean;
  onPlaceUpdated?: (place: Place) => void | Promise<void>;
  /** Удалить место (возвращает true при успехе) */
  onPlaceDeleted?: (placeId: string) => Promise<boolean>;
};

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

export function PlaceModal({
  place,
  onClose,
  adminMode = false,
  onPlaceUpdated,
  onPlaceDeleted,
}: Props) {
  const [ratingEditing, setRatingEditing] = useState(false);
  const [ratingDraft, setRatingDraft] = useState('');
  const [ratingBusy, setRatingBusy] = useState(false);
  const [storyEditing, setStoryEditing] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [storyBusy, setStoryBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteConfirmOpen) {
        setDeleteConfirmOpen(false);
        return;
      }
      onClose();
    },
    [onClose, deleteConfirmOpen],
  );

  useEffect(() => {
    if (!place) return;
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [place, onKey]);

  const sortedCategories = useMemo(() => {
    if (!place) return [] as PlaceCategory[]
    return [...place.categories].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
    )
  }, [place])

  const coordLine = useMemo(() => {
    if (!place || place.lng == null || place.lat == null) return null
    return `${place.lng.toFixed(6)}, ${place.lat.toFixed(6)}`
  }, [place])

  if (!place) return null

  const photoUrls = place.photos;
  const hasPhotos = photoUrls != null && photoUrls.length > 0;
  const ratingLabel =
    place.googleRating != null ? `${place.googleRating.toFixed(1)} / 5` : '—';

  const canEditRating =
    adminMode &&
    place.googleRating == null &&
    typeof onPlaceUpdated === 'function';

  const canEditStory =
    adminMode && typeof onPlaceUpdated === 'function';

  const canDeletePlace =
    adminMode && typeof onPlaceDeleted === 'function';

  const commitRating = async () => {
    if (!onPlaceUpdated) return;
    const n = Number(ratingDraft.replace(',', '.'));
    if (Number.isNaN(n) || n < 0 || n > 5) {
      window.alert('Введите оценку от 0 до 5.');
      return;
    }
    setRatingBusy(true);
    try {
      await Promise.resolve(onPlaceUpdated({ ...place, googleRating: n }));
      setRatingEditing(false);
    } finally {
      setRatingBusy(false);
    }
  };

  const commitStory = async () => {
    if (!onPlaceUpdated) return;
    const s = storyDraft.trim();
    if (!s) {
      window.alert('Текст впечатлений не может быть пустым.');
      return;
    }
    setStoryBusy(true);
    try {
      await Promise.resolve(onPlaceUpdated({ ...place, story: s }));
      setStoryEditing(false);
    } finally {
      setStoryBusy(false);
    }
  };

  const confirmDeletePlace = async () => {
    if (!onPlaceDeleted || !place) return;
    setDeleteConfirmOpen(false);
    setDeleteBusy(true);
    try {
      const ok = await onPlaceDeleted(place.id);
      if (ok) onClose();
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div
      className="modal-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-dialog modal-dialog--place-view"
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
        {coordLine ? (
          <p className="modal-coords" aria-label="Координаты">
            {coordLine}
          </p>
        ) : null}

        {sortedCategories.length > 0 ? (
          <div className="modal-place-cats" aria-label="Категории">
            {sortedCategories.map((cat) => (
              <span
                key={cat}
                className={`modal-place-cat-badge modal-place-cat-badge--${cat}`}
              >
                {CATEGORY_LABELS[cat]}
              </span>
            ))}
          </div>
        ) : null}

        <p className="modal-summary modal-summary--place-lead">{place.summary}</p>

        <div className="modal-rating modal-rating--block">
          <span className="modal-rating__label">Оценка Google Maps:</span>
          {place.googleRating != null ? (
            <strong className="modal-rating__value">{ratingLabel}</strong>
          ) : ratingEditing ? (
            <span className="modal-rating__edit">
              <input
                type="text"
                inputMode="decimal"
                className="modal-rating__input"
                value={ratingDraft}
                onChange={(e) => setRatingDraft(e.target.value)}
                placeholder="0–5"
                disabled={ratingBusy}
                aria-label="Оценка Google Maps"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRating();
                  if (e.key === 'Escape') setRatingEditing(false);
                }}
              />
              <button
                type="button"
                className="modal-rating__save"
                disabled={ratingBusy}
                onClick={() => void commitRating()}
              >
                {ratingBusy ? '…' : 'Сохранить'}
              </button>
              <button
                type="button"
                className="modal-rating__cancel"
                disabled={ratingBusy}
                onClick={() => setRatingEditing(false)}
              >
                Отмена
              </button>
            </span>
          ) : canEditRating ? (
            <button
              type="button"
              className="modal-rating__add"
              onClick={() => setRatingEditing(true)}
            >
              Добавить оценку
            </button>
          ) : (
            <strong className="modal-rating__value">—</strong>
          )}
        </div>

        {hasPhotos && photoUrls ? (
          <ModalPhotoCarousel key={place.id} photos={photoUrls} />
        ) : null}

        <div className="modal-story">
          <div className="modal-story__head">
            <h3 className="modal-story__heading">Наши впечатления</h3>
            {canEditStory && !storyEditing ? (
              <button
                type="button"
                className="modal-story__edit"
                onClick={() => {
                  setStoryDraft(place.story);
                  setStoryEditing(true);
                }}
              >
                Редактировать
              </button>
            ) : null}
          </div>
          {storyEditing ? (
            <div className="modal-story__edit-box">
              <textarea
                className="modal-story__textarea"
                value={storyDraft}
                onChange={(e) => setStoryDraft(e.target.value)}
                rows={6}
                disabled={storyBusy}
                aria-label="Наши впечатления"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setStoryEditing(false);
                  }
                }}
              />
              <div className="modal-story__edit-actions">
                <button
                  type="button"
                  className="modal-rating__save"
                  disabled={storyBusy}
                  onClick={() => void commitStory()}
                >
                  {storyBusy ? '…' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  className="modal-rating__cancel"
                  disabled={storyBusy}
                  onClick={() => setStoryEditing(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <p className="modal-story__text">{place.story}</p>
          )}
        </div>

        {canDeletePlace ? (
          <div className="modal-place-delete">
            <button
              type="button"
              className="modal-place-delete__btn"
              disabled={deleteBusy || ratingBusy || storyBusy || deleteConfirmOpen}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              {deleteBusy ? 'Удаление…' : 'Удалить место'}
            </button>
          </div>
        ) : null}
      </div>

      {deleteConfirmOpen ? (
        <div
          className="confirm-modal-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmOpen(false);
          }}
        >
          <div
            className="confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-place-title"
            aria-describedby="confirm-delete-place-desc"
          >
            <h2 id="confirm-delete-place-title" className="confirm-modal__title">
              Удалить место?
            </h2>
            <p id="confirm-delete-place-desc" className="confirm-modal__text">
              Место «{place.name}» будет удалено без возможности восстановления.
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--ghost"
                disabled={deleteBusy}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--danger"
                disabled={deleteBusy}
                onClick={() => void confirmDeletePlace()}
              >
                {deleteBusy ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
