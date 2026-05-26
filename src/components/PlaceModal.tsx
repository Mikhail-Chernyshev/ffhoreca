import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Place, PlaceCategory } from '../data/types';
import { apiBaseUrl, mediaUrl } from '../lib/apiBase';
import { useLocale, useT } from '../i18n/LocaleContext';
import { categoryLabel } from '../i18n/labels';

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
  const t = useT();
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
            aria-label={t('placeModal.ariaPrevPhoto')}
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
            aria-label={t('placeModal.ariaNextPhoto')}
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
  const t = useT();
  const { locale } = useLocale();
  const [cardEditing, setCardEditing] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [draftCats, setDraftCats] = useState<PlaceCategory[]>([]);
  const [draftSummary, setDraftSummary] = useState('');
  const [draftStory, setDraftStory] = useState('');
  const [draftRating, setDraftRating] = useState('');
  const [draftPhotos, setDraftPhotos] = useState<string[]>([]);
  const [fileUploadBusy, setFileUploadBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteConfirmOpen) {
        setDeleteConfirmOpen(false);
        return;
      }
      if (cardEditing) {
        setCardEditing(false);
        return;
      }
      onClose();
    },
    [onClose, deleteConfirmOpen, cardEditing],
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
  const canDeletePlace = adminMode && typeof onPlaceDeleted === 'function';

  const startCardEdit = () => {
    setDraftCats([...place.categories]);
    setDraftSummary(place.summary);
    setDraftStory(place.story);
    setDraftRating(
      place.googleRating != null ? String(place.googleRating) : '',
    );
    setDraftPhotos(place.photos ?? []);
    setCardEditing(true);
  };

  const commitCard = async () => {
    if (!onPlaceUpdated) return;
    if (draftCats.length === 0) {
      window.alert(t('placeModal.alertCategoryRequired'));
      return;
    }
    const summary = draftSummary.trim();
    const story = draftStory.trim();
    if (!summary) {
      window.alert(t('placeModal.alertSummaryRequired'));
      return;
    }
    if (!story) {
      window.alert(t('placeModal.alertStoryRequired'));
      return;
    }
    let googleRating: number | null = place.googleRating;
    const ratingStr = draftRating.trim();
    if (ratingStr) {
      const n = Number(ratingStr.replace(',', '.'));
      if (Number.isNaN(n) || n < 0 || n > 5) {
        window.alert(t('placeModal.alertRatingRange'));
        return;
      }
      googleRating = n;
    }
    const photos = draftPhotos.length > 0 ? draftPhotos : null;
    setCardBusy(true);
    try {
      await Promise.resolve(
        onPlaceUpdated({
          ...place,
          categories: draftCats,
          summary,
          story,
          googleRating,
          photos,
        }),
      );
      setCardEditing(false);
    } finally {
      setCardBusy(false);
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
    if (next < 0 || next >= draftPhotos.length) return;
    const arr = [...draftPhotos];
    [arr[index], arr[next]] = [arr[next]!, arr[index]!];
    setDraftPhotos(arr);
  };

  const handlePhotoFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const base = apiBaseUrl();
    const token =
      new URLSearchParams(window.location.search).get('token') ?? '';
    if (!base || !token) {
      window.alert(t('placeModal.alertUploadNeedsApi'));
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
        window.alert(t('placeModal.alertPhotoUploadFailed'));
        return;
      }
      const json = (await res.json()) as { urls: string[] };
      setDraftPhotos((prev) => [...prev, ...json.urls]);
    } catch (e) {
      window.alert(t('placeModal.alertGenericError', { message: e instanceof Error ? e.message : String(e) }));
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
          aria-label={t('common.close')}
        >
          ×
        </button>

        <h2 id='place-modal-title' className='modal-title'>
          {place.name}
        </h2>

        <p className='modal-address'>{place.address}</p>
        {coordLine ? (
          <p className='modal-coords' aria-label={t('placeModal.ariaCoords')}>
            {coordLine}
          </p>
        ) : null}

        {canEdit && !cardEditing ? (
          <div className="modal-place-edit-bar">
            <button
              type="button"
              className="modal-rating__save"
              onClick={startCardEdit}
            >
              {t('placeModal.edit')}
            </button>
          </div>
        ) : null}

        {cardEditing ? (
          <div className="modal-place-card-edit">
            <fieldset className="add-place-form__fieldset">
              <legend className="add-place-form__legend">{t('placeModal.categories')}</legend>
              <div className="modal-edit-cats__checks">
                {CATEGORY_ORDER.map((cat) => (
                  <label key={cat} className="add-place-form__check">
                    <input
                      type="checkbox"
                      checked={draftCats.includes(cat)}
                      disabled={cardBusy}
                      onChange={() =>
                        setDraftCats((prev) =>
                          prev.includes(cat)
                            ? prev.filter((c) => c !== cat)
                            : [...prev, cat],
                        )
                      }
                    />
                    {categoryLabel(locale, cat)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="add-place-form__label">
              {t('placeModal.summary')}
              <input
                className="add-place-form__input"
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                disabled={cardBusy}
              />
            </label>

            <label className="add-place-form__label">
              {t('placeModal.ratingOptional')}
              <input
                className="add-place-form__input"
                value={draftRating}
                onChange={(e) => setDraftRating(e.target.value)}
                inputMode="decimal"
                disabled={cardBusy}
                placeholder="4.5"
              />
            </label>

            <div className="modal-photos-edit">
              <p className="add-place-form__legend">{t('placeModal.photos')}</p>
              <div className="modal-photos-edit__list">
                {draftPhotos.map((url, i) => (
                  <div key={url + i} className="modal-photos-edit__item">
                    <img src={mediaUrl(url)} alt="" className="modal-photos-edit__thumb" />
                    <div className="modal-photos-edit__actions">
                      <button type="button" onClick={() => movePhoto(i, -1)} disabled={i === 0 || cardBusy} aria-label={t('placeModal.ariaMoveUp')}>↑</button>
                      <button type="button" onClick={() => movePhoto(i, 1)} disabled={i === draftPhotos.length - 1 || cardBusy} aria-label={t('placeModal.ariaMoveDown')}>↓</button>
                      <button
                        type="button"
                        className="modal-photos-edit__delete"
                        disabled={cardBusy}
                        onClick={() => setDraftPhotos((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={t('placeModal.ariaDeletePhoto')}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="modal-photos-edit__file-label">
                {fileUploadBusy ? t('common.loading') : `📁 ${t('placeModal.uploadFiles')}`}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="modal-photos-edit__file-input"
                  disabled={cardBusy || fileUploadBusy}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    void handlePhotoFiles(files);
                  }}
                />
              </label>
            </div>

            <label className="add-place-form__label">
              {t('placeModal.ourImpressions')}
              <textarea
                className="modal-story__textarea"
                value={draftStory}
                onChange={(e) => setDraftStory(e.target.value)}
                rows={6}
                disabled={cardBusy}
              />
            </label>

            <div className="modal-story__edit-actions">
              <button type="button" className="modal-rating__save" disabled={cardBusy} onClick={() => void commitCard()}>
                {cardBusy ? t('common.busy') : t('common.save')}
              </button>
              <button type="button" className="modal-rating__cancel" disabled={cardBusy} onClick={() => setCardEditing(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-place-cats" aria-label={t('placeModal.categories')}>
              {sortedCategories.map((cat) => (
                <span key={cat} className={`modal-place-cat-badge modal-place-cat-badge--${cat}`}>
                  {categoryLabel(locale, cat)}
                </span>
              ))}
            </div>

            <p className="modal-summary modal-summary--place-lead">{place.summary}</p>

            <div className="modal-rating modal-rating--block">
              <span className="modal-rating__label">{t('placeModal.ratingLabel')}</span>
              <strong className="modal-rating__value">{ratingLabel}</strong>
            </div>

            {hasPhotos && photoUrls ? (
              <ModalPhotoCarousel key={place.id} photos={photoUrls} />
            ) : null}

            <div className="modal-story">
              <h3 className="modal-story__heading">{t('placeModal.ourImpressions')}</h3>
              <p className="modal-story__text">{place.story}</p>
            </div>
          </>
        )}

        {canDeletePlace ? (
          <div className='modal-place-delete'>
            <button
              type='button'
              className='modal-place-delete__btn'
              disabled={deleteBusy || cardBusy || deleteConfirmOpen}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              {deleteBusy ? t('common.deleting') : t('placeModal.delete')}
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
              {t('placeModal.confirmDeleteTitle')}
            </h2>
            <p id='confirm-delete-place-desc' className='confirm-modal__text'>
              {t('placeModal.confirmDeleteMessage', { name: place.name })}
            </p>
            <div className='confirm-modal__actions'>
              <button
                type='button'
                className='confirm-modal__btn confirm-modal__btn--ghost'
                disabled={deleteBusy}
                onClick={() => setDeleteConfirmOpen(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type='button'
                className='confirm-modal__btn confirm-modal__btn--danger'
                disabled={deleteBusy}
                onClick={() => void confirmDeletePlace()}
              >
                {deleteBusy ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
