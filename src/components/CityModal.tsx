import { useCallback, useEffect, useState } from 'react'
import countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json'
import ru from 'i18n-iso-countries/langs/ru.json'
import type { City } from '../data/types'
import { apiBaseUrl, apiFetch, mediaUrl } from '../lib/apiBase'
import { authHeaders } from '../lib/apiAuth'
import { ModalPhotoCarousel } from './PlaceModal'
import { useAlert } from './AlertProvider'
import { useLocale, useT } from '../i18n/LocaleContext'

countries.registerLocale(ru)
countries.registerLocale(en)

function countryName(code: string, locale: 'ru' | 'en'): string {
  return countries.getName(code, locale) ?? code
}

type Props = {
  city: City | null
  onClose: () => void
  canEdit?: boolean
  onCityUpdated?: (city: City) => void | Promise<void>
  uploadPhotos?: (files: File[]) => Promise<string[]>
}

export function CityModal({
  city,
  onClose,
  canEdit = false,
  onCityUpdated,
  uploadPhotos,
}: Props) {
  const t = useT()
  const { locale } = useLocale()
  const { showAlert } = useAlert()
  const [cardEditing, setCardEditing] = useState(false)
  const [cardBusy, setCardBusy] = useState(false)
  const [draftSummary, setDraftSummary] = useState('')
  const [draftStory, setDraftStory] = useState('')
  const [draftPhotos, setDraftPhotos] = useState<string[]>([])
  const [fileUploadBusy, setFileUploadBusy] = useState(false)

  const editable = canEdit && typeof onCityUpdated === 'function'

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (cardEditing) {
        setCardEditing(false)
        return
      }
      onClose()
    },
    [onClose, cardEditing],
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

  useEffect(() => {
    setCardEditing(false)
  }, [city?.id])

  if (!city) return null

  const photos = city.photos ?? []
  const hasPhotos = photos.length > 0
  const country = countryName(city.countryCode, locale)
  const coords = `${city.lat.toFixed(4)}°, ${city.lng.toFixed(4)}°`
  const hasSummary = Boolean(city.summary?.trim())
  const hasStory = Boolean(city.story?.trim())

  const startCardEdit = () => {
    setDraftSummary(city.summary ?? '')
    setDraftStory(city.story ?? '')
    setDraftPhotos(city.photos ?? [])
    setCardEditing(true)
  }

  const movePhoto = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= draftPhotos.length) return
    const arr = [...draftPhotos]
    ;[arr[index], arr[next]] = [arr[next]!, arr[index]!]
    setDraftPhotos(arr)
  }

  const handlePhotoFiles = async (files: File[]) => {
    if (files.length === 0) return
    const base = apiBaseUrl()
    if (!base) {
      showAlert(t('placeModal.alertUploadNeedsApi'))
      return
    }
    setFileUploadBusy(true)
    try {
      if (uploadPhotos) {
        const urls = await uploadPhotos(files)
        setDraftPhotos((prev) => [...prev, ...urls])
        return
      }
      const fd = new FormData()
      for (const file of files) fd.append('photos', file)
      const res = await apiFetch(`${base}/api/photos`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      })
      if (!res.ok) {
        showAlert(t('placeModal.alertPhotoUploadFailed'))
        return
      }
      const json = (await res.json()) as { urls: string[] }
      setDraftPhotos((prev) => [...prev, ...json.urls])
    } catch (e) {
      showAlert(
        t('placeModal.alertGenericError', {
          message: e instanceof Error ? e.message : String(e),
        }),
      )
    } finally {
      setFileUploadBusy(false)
    }
  }

  const commitCard = async () => {
    if (!onCityUpdated) return
    const summary = draftSummary.trim()
    const story = draftStory.trim()
    const nextPhotos = draftPhotos.length > 0 ? draftPhotos : undefined
    const next: City = {
      ...city,
      ...(summary ? { summary } : { summary: undefined }),
      ...(story ? { story } : { story: undefined }),
      photos: nextPhotos,
    }
    if (!summary) delete next.summary
    if (!story) delete next.story
    if (!nextPhotos) delete next.photos
    setCardBusy(true)
    try {
      await Promise.resolve(onCityUpdated(next))
      setCardEditing(false)
    } catch {
      /* remain in edit mode */
    } finally {
      setCardBusy(false)
    }
  }

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
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          ×
        </button>

        <div className="modal-dialog__scroll">
          <h2 id="city-modal-title" className="modal-title">
            {city.name}
          </h2>
          <p className="modal-address">
            {country} · {coords}
          </p>

          {cardEditing ? (
            <div className="modal-place-card-edit">
              <label className="add-place-form__label">
                {t('cityModal.summary')}
                <input
                  className="add-place-form__input"
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  disabled={cardBusy}
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
                      const files = Array.from(e.target.files ?? [])
                      e.target.value = ''
                      void handlePhotoFiles(files)
                    }}
                  />
                </label>
              </div>

              <label className="add-place-form__label">
                {t('cityModal.notesHeading')}
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
              {hasSummary ? (
                <p className="modal-summary">{city.summary}</p>
              ) : (
                <p className="modal-summary modal-summary--muted">
                  {editable ? t('cityModal.emptySummaryHintEdit') : t('cityModal.emptySummaryHint')}
                </p>
              )}

              {hasPhotos && <ModalPhotoCarousel key={city.id} photos={photos} />}

              {hasStory ? (
                <>
                  <h3 className="modal-section-title">{t('cityModal.notesHeading')}</h3>
                  <p className="modal-story">{city.story}</p>
                </>
              ) : null}

              {editable ? (
                <div className="modal-place-actions">
                  <button
                    type="button"
                    className="modal-place-actions__edit"
                    onClick={startCardEdit}
                  >
                    {t('placeModal.edit')}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
