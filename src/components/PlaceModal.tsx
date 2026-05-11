import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Place, PlaceCategory } from '../data/types';
import { apiBaseUrl, mediaUrl } from '../lib/apiBase';

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  attraction: 'Места',
  lodging: 'Жильё',
  food: 'Еда',
  bar: 'Бары',
  airport: 'Аэропорты',
};

const CATEGORY_ORDER: PlaceCategory[] = [
  'attraction',
  'lodging',
  'food',
  'bar',
  'airport',
];

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
  const [photoIndex, setPhotoIndex] = useState(0);

  return (
    <div className='modal-carousel'>
      <div className='modal-carousel__viewport'>
        <img
          className='modal-carousel__img'
          src={mediaUrl(photos[photoIndex] ?? '')}
          alt=''
          width={900}
          height={560}
        />
      </div>
      {photos.length > 1 && (
        <div className='modal-carousel__controls'>
          <button
            type='button'
            className='modal-carousel__btn'
            onClick={() =>
              setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)
            }
            aria-label='Предыдущее фото'
          >
            ‹
          </button>
          <span className='modal-carousel__counter'>
            {photoIndex + 1} / {photos.length}
          </span>
          <button
            type='button'
            className='modal-carousel__btn'
            onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
            aria-label='Следующее фото'
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
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

  // Редактирование категорий
  const [catEditing, setCatEditing] = useState(false);
  const [catDraft, setCatDraft] = useState<PlaceCategory[]>([]);
  const [catBusy, setCatBusy] = useState(false);

  // Редактирование фотографий
  const [photosEditing, setPhotosEditing] = useState(false);
  const [photosDraft, setPhotosDraft] = useState<string[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [fileUploadBusy, setFileUploadBusy] = useState(false);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteConfirmOpen) {
        setDeleteConfirmOpen(false);
        return;
      }
      if (catEditing) {
        setCatEditing(false);
        return;
      }
      if (photosEditing) {
        setPhotosEditing(false);
        return;
      }
      onClose();
    },
    [onClose, deleteConfirmOpen, catEditing, photosEditing],
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
    if (!place) return [] as PlaceCategory[];
    return [...place.categories].sort(
      (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
    );
  }, [place]);

  const coordLine = useMemo(() => {
    if (!place || place.lng == null || place.lat == null) return null;
    return `${place.lng.toFixed(6)}, ${place.lat.toFixed(6)}`;
  }, [place]);

  if (!place) return null;

  const photoUrls = place.photos;
  const hasPhotos = photoUrls != null && photoUrls.length > 0;
  const ratingLabel =
    place.googleRating != null ? `${place.googleRating.toFixed(1)} / 5` : '—';

  const canEdit = adminMode && typeof onPlaceUpdated === 'function';
  const canEditRating = canEdit && place.googleRating == null;
  const canDeletePlace = adminMode && typeof onPlaceDeleted === 'function';

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

  const commitCategories = async () => {
    if (!onPlaceUpdated) return;
    if (catDraft.length === 0) {
      window.alert('Выберите хотя бы одну категорию.');
      return;
    }
    setCatBusy(true);
    try {
      await Promise.resolve(onPlaceUpdated({ ...place, categories: catDraft }));
      setCatEditing(false);
    } finally {
      setCatBusy(false);
    }
  };

  const commitPhotos = async () => {
    if (!onPlaceUpdated) return;
    setPhotosBusy(true);
    const photos = photosDraft.length > 0 ? photosDraft : null;
    try {
      await Promise.resolve(onPlaceUpdated({ ...place, photos }));
      setPhotosEditing(false);
    } finally {
      setPhotosBusy(false);
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

  const movePhoto = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= photosDraft.length) return;
    const arr = [...photosDraft];
    [arr[index], arr[next]] = [arr[next]!, arr[index]!];
    setPhotosDraft(arr);
  };

  const handlePhotoFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const base = apiBaseUrl();
    const token =
      new URLSearchParams(window.location.search).get('token') ?? '';
    if (!base || !token) {
      window.alert('Загрузка файлов требует настроенного API и токена в URL.');
      return;
    }
    setFileUploadBusy(true);
    try {
      const fd = new FormData();
      for (const file of files) fd.append('photos', file);
      const res = await fetch(`${base}/api/photos`, {
        method: 'POST',
        headers: { 'X-Admin-Token': token },
        body: fd,
      });
      if (!res.ok) {
        window.alert('Ошибка загрузки фото на сервер.');
        return;
      }
      const json = (await res.json()) as { urls: string[] };
      setPhotosDraft((prev) => [...prev, ...json.urls]);
    } catch (e) {
      window.alert(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setFileUploadBusy(false);
    }
  };

  return (
    <div
      className='modal-root'
      role='presentation'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className='modal-dialog modal-dialog--place-view'
        role='dialog'
        aria-modal='true'
        aria-labelledby='place-modal-title'
      >
        <button
          type='button'
          className='modal-close'
          onClick={onClose}
          aria-label='Закрыть'
        >
          ×
        </button>

        <h2 id='place-modal-title' className='modal-title'>
          {place.name}
        </h2>

        <p className='modal-address'>{place.address}</p>
        {coordLine ? (
          <p className='modal-coords' aria-label='Координаты'>
            {coordLine}
          </p>
        ) : null}

        {/* Категории */}
        {catEditing ? (
          <div className='modal-edit-cats'>
            <div className='modal-edit-cats__checks'>
              {CATEGORY_ORDER.map((cat) => (
                <label key={cat} className='add-place-form__check'>
                  <input
                    type='checkbox'
                    checked={catDraft.includes(cat)}
                    disabled={catBusy}
                    onChange={() =>
                      setCatDraft((prev) =>
                        prev.includes(cat)
                          ? prev.filter((c) => c !== cat)
                          : [...prev, cat],
                      )
                    }
                  />
                  {CATEGORY_LABELS[cat]}
                </label>
              ))}
            </div>
            <div className='modal-story__edit-actions'>
              <button
                type='button'
                className='modal-rating__save'
                disabled={catBusy}
                onClick={() => void commitCategories()}
              >
                {catBusy ? '…' : 'Сохранить'}
              </button>
              <button
                type='button'
                className='modal-rating__cancel'
                disabled={catBusy}
                onClick={() => setCatEditing(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className='modal-place-cats' aria-label='Категории'>
            {sortedCategories.map((cat) => (
              <span
                key={cat}
                className={`modal-place-cat-badge modal-place-cat-badge--${cat}`}
              >
                {CATEGORY_LABELS[cat]}
              </span>
            ))}
            {canEdit && (
              <button
                type='button'
                className='modal-rating__add'
                onClick={() => {
                  setCatDraft([...place.categories]);
                  setCatEditing(true);
                }}
              >
                Изменить
              </button>
            )}
          </div>
        )}

        <p className='modal-summary modal-summary--place-lead'>
          {place.summary}
        </p>

        {/* Оценка */}
        <div className='modal-rating modal-rating--block'>
          <span className='modal-rating__label'>Оценка Google Maps:</span>
          {place.googleRating != null ? (
            <strong className='modal-rating__value'>{ratingLabel}</strong>
          ) : ratingEditing ? (
            <span className='modal-rating__edit'>
              <input
                type='text'
                inputMode='decimal'
                className='modal-rating__input'
                value={ratingDraft}
                onChange={(e) => setRatingDraft(e.target.value)}
                placeholder='0–5'
                disabled={ratingBusy}
                aria-label='Оценка Google Maps'
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRating();
                  if (e.key === 'Escape') setRatingEditing(false);
                }}
              />
              <button
                type='button'
                className='modal-rating__save'
                disabled={ratingBusy}
                onClick={() => void commitRating()}
              >
                {ratingBusy ? '…' : 'Сохранить'}
              </button>
              <button
                type='button'
                className='modal-rating__cancel'
                disabled={ratingBusy}
                onClick={() => setRatingEditing(false)}
              >
                Отмена
              </button>
            </span>
          ) : canEditRating ? (
            <button
              type='button'
              className='modal-rating__add'
              onClick={() => setRatingEditing(true)}
            >
              Добавить оценку
            </button>
          ) : (
            <strong className='modal-rating__value'>—</strong>
          )}
        </div>

        {/* Фотографии */}
        {photosEditing ? (
          <div className='modal-photos-edit'>
            <div className='modal-photos-edit__list'>
              {photosDraft.map((url, i) => (
                <div key={url + i} className='modal-photos-edit__item'>
                  <img
                    src={mediaUrl(url)}
                    alt=''
                    className='modal-photos-edit__thumb'
                  />
                  <div className='modal-photos-edit__actions'>
                    <button
                      type='button'
                      onClick={() => movePhoto(i, -1)}
                      disabled={i === 0 || photosBusy}
                      aria-label='Вверх'
                    >
                      ↑
                    </button>
                    <button
                      type='button'
                      onClick={() => movePhoto(i, 1)}
                      disabled={i === photosDraft.length - 1 || photosBusy}
                      aria-label='Вниз'
                    >
                      ↓
                    </button>
                    <button
                      type='button'
                      className='modal-photos-edit__delete'
                      disabled={photosBusy}
                      onClick={() =>
                        setPhotosDraft((prev) => prev.filter((_, j) => j !== i))
                      }
                      aria-label='Удалить'
                    >
                      ✕
                    </button>
                  </div>
                  <span className='modal-photos-edit__url' title={url}>
                    {url}
                  </span>
                </div>
              ))}
            </div>
            <div className='modal-photos-edit__add'>
              <label className='modal-photos-edit__file-label'>
                {fileUploadBusy ? 'Загрузка…' : '📁 Загрузить файлы'}
                <input
                  type='file'
                  accept='image/jpeg,image/png,image/webp,image/gif'
                  multiple
                  className='modal-photos-edit__file-input'
                  disabled={photosBusy || fileUploadBusy}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    void handlePhotoFiles(files);
                  }}
                />
              </label>
            </div>
            {/* <div className='modal-photos-edit__add'>
              <button
                type='button'
                className='modal-rating__add'
                disabled={!newPhotoUrl.trim() || photosBusy || fileUploadBusy}
                onClick={() => {
                  if (newPhotoUrl.trim()) {
                    setPhotosDraft((prev) => [...prev, newPhotoUrl.trim()]);
                    setNewPhotoUrl('');
                  }
                }}
              >
                Добавить
              </button>
            </div> */}
            <div className='modal-story__edit-actions'>
              <button
                type='button'
                className='modal-rating__save'
                disabled={photosBusy}
                onClick={() => void commitPhotos()}
              >
                {photosBusy ? '…' : 'Сохранить'}
              </button>
              <button
                type='button'
                className='modal-rating__cancel'
                disabled={photosBusy}
                onClick={() => setPhotosEditing(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            {hasPhotos && photoUrls ? (
              <ModalPhotoCarousel key={place.id} photos={photoUrls} />
            ) : null}
            {canEdit && (
              <button
                type='button'
                className='modal-rating__add'
                style={{ marginBottom: '0.75rem' }}
                onClick={() => {
                  setPhotosDraft(place.photos ?? []);
                  setPhotosEditing(true);
                }}
              >
                {hasPhotos ? 'Редактировать фото' : 'Добавить фото'}
              </button>
            )}
          </>
        )}

        {/* Впечатления */}
        <div className='modal-story'>
          <div className='modal-story__head'>
            <h3 className='modal-story__heading'>Наши впечатления</h3>
            {canEdit && !storyEditing ? (
              <button
                type='button'
                className='modal-story__edit'
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
            <div className='modal-story__edit-box'>
              <textarea
                className='modal-story__textarea'
                value={storyDraft}
                onChange={(e) => setStoryDraft(e.target.value)}
                rows={6}
                disabled={storyBusy}
                aria-label='Наши впечатления'
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setStoryEditing(false);
                  }
                }}
              />
              <div className='modal-story__edit-actions'>
                <button
                  type='button'
                  className='modal-rating__save'
                  disabled={storyBusy}
                  onClick={() => void commitStory()}
                >
                  {storyBusy ? '…' : 'Сохранить'}
                </button>
                <button
                  type='button'
                  className='modal-rating__cancel'
                  disabled={storyBusy}
                  onClick={() => setStoryEditing(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <p className='modal-story__text'>{place.story}</p>
          )}
        </div>

        {canDeletePlace ? (
          <div className='modal-place-delete'>
            <button
              type='button'
              className='modal-place-delete__btn'
              disabled={
                deleteBusy ||
                ratingBusy ||
                storyBusy ||
                catBusy ||
                photosBusy ||
                deleteConfirmOpen
              }
              onClick={() => setDeleteConfirmOpen(true)}
            >
              {deleteBusy ? 'Удаление…' : 'Удалить место'}
            </button>
          </div>
        ) : null}
      </div>

      {deleteConfirmOpen ? (
        <div
          className='confirm-modal-overlay'
          role='presentation'
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmOpen(false);
          }}
        >
          <div
            className='confirm-modal'
            role='alertdialog'
            aria-modal='true'
            aria-labelledby='confirm-delete-place-title'
            aria-describedby='confirm-delete-place-desc'
          >
            <h2
              id='confirm-delete-place-title'
              className='confirm-modal__title'
            >
              Удалить место?
            </h2>
            <p id='confirm-delete-place-desc' className='confirm-modal__text'>
              Место «{place.name}» будет удалено без возможности восстановления.
            </p>
            <div className='confirm-modal__actions'>
              <button
                type='button'
                className='confirm-modal__btn confirm-modal__btn--ghost'
                disabled={deleteBusy}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Отмена
              </button>
              <button
                type='button'
                className='confirm-modal__btn confirm-modal__btn--danger'
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
  );
}
