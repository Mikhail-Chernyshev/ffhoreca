import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import type { Catalog, City, Place, PlaceCategory } from '../data/types';
import { catalogCityIdFromPhotonHints } from '../data/selectors';
import { validateNewPlaceRequired } from '../lib/validateNewPlaceForm';
import { makeCityId } from '../lib/makeCityId';
import { searchPhotonAddresses, type AddressSuggestion } from '../lib/photonAddressSearch';
import { useLocale, useT } from '../i18n/LocaleContext';
import { categoryLabel } from '../i18n/labels';

type Props = {
  onClose: () => void;
  catalog: Catalog;
  onSaved: (place: Place, city: City) => void | Promise<void>;
};

const CATEGORY_VALUES: PlaceCategory[] = ['attraction', 'lodging', 'food', 'bar', 'airport'];

function buildPlace(form: {
  name: string;
  cityId: string;
  categories: PlaceCategory[];
  address: string;
  summary: string;
  story: string;
  lng: string;
  lat: string;
  rating: string;
  photosRaw: string;
}): Place | null {
  const name = form.name.trim();
  const cityId = form.cityId.trim();
  if (!name || !cityId || form.categories.length === 0) return null;
  const address = form.address.trim();
  const summary = form.summary.trim();
  const story = form.story.trim();
  if (!address || !summary || !story) return null;

  const lines = form.photosRaw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const photos: string[] | null = lines.length > 0 ? lines : null;

  let googleRating: number | null = null;
  if (form.rating.trim() !== '') {
    const n = Number(form.rating.replace(',', '.'));
    if (!Number.isNaN(n) && n >= 0 && n <= 5) googleRating = n;
  }

  let lng: number | undefined;
  let lat: number | undefined;
  if (form.lng.trim() !== '' && form.lat.trim() !== '') {
    const lo = Number(form.lng.replace(',', '.'));
    const la = Number(form.lat.replace(',', '.'));
    if (!Number.isNaN(lo) && !Number.isNaN(la)) {
      lng = lo;
      lat = la;
    }
  }

  return {
    id: `extra-${Date.now()}`,
    name,
    countryCode: '', // заполним из города перед onSaved
    cityId,
    categories: [...form.categories],
    address,
    summary,
    googleRating,
    photos,
    story,
    lng,
    lat,
  };
}

export function AddPlaceModal({ onClose, catalog, onSaved }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const [name, setName] = useState('');
  const [cityId, setCityId] = useState(catalog.cities[0]?.id ?? '');
  const [cats, setCats] = useState<PlaceCategory[]>(['attraction']);
  /** Города, созданные «на лету» из результатов поиска (не в каталоге) */
  const [localCities, setLocalCities] = useState<City[]>([]);
  const [address, setAddress] = useState('');
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [summary, setSummary] = useState('');
  const [story, setStory] = useState('');
  const [lng, setLng] = useState('');
  const [lat, setLat] = useState('');
  const [rating, setRating] = useState('');
  const photosRaw = '';
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoUploadBusy, setPhotoUploadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<AddressSuggestion[]>([]);
  const [placeSuggestOpen, setPlaceSuggestOpen] = useState(false);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [placeSearchDebouncing, setPlaceSearchDebouncing] = useState(false);
  const [placeNoResults, setPlaceNoResults] = useState(false);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onKey]);

  const toggleCat = (c: PlaceCategory) => {
    setCats((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  /** Полный список городов: из каталога + созданные «на лету» из поиска */
  const allCities = useMemo(
    () => [...catalog.cities, ...localCities],
    [catalog.cities, localCities],
  );

  const cityCenter = useMemo(() => {
    const c = allCities.find((c) => c.id === cityId);
    return c ? { lat: c.lat, lng: c.lng } : undefined;
  }, [allCities, cityId]);

  useEffect(() => {
    const q = placeSearchQuery.trim();
    if (q.length < 3) return;

    const ac = new AbortController();
    const t = window.setTimeout(() => {
      setPlaceSearchDebouncing(false);
      setPlaceSearchLoading(true);
      setPlaceNoResults(false);
      setPlaceSuggestions([]);
      void (async () => {
        try {
          const list = await searchPhotonAddresses(q, cityCenter, ac.signal);
          if (!ac.signal.aborted) {
            setPlaceSuggestions(list);
            setPlaceNoResults(list.length === 0);
          }
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            setPlaceSuggestions([]);
            setPlaceNoResults(true);
          }
        } finally {
          if (!ac.signal.aborted) setPlaceSearchLoading(false);
        }
      })();
    }, 400);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [placeSearchQuery, cityCenter]);

  const resolveCityFromCatalogOrCreate = (
    name: string,
    cc: string,
    coords: { lat: number; lng: number },
  ): string => {
    const norm = (str: string) =>
      str.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
    const nameNorm = norm(name);
    const existing = allCities.find(
      (c) => c.countryCode.toUpperCase() === cc && norm(c.name) === nameNorm,
    );
    if (existing) return existing.id;

    const newId = makeCityId(cc, name);
    if (!localCities.some((c) => c.id === newId)) {
      const newCity: City = {
        id: newId,
        name,
        countryCode: cc,
        lat: Math.round(coords.lat * 1e4) / 1e4,
        lng: Math.round(coords.lng * 1e4) / 1e4,
      };
      setLocalCities((prev) => [...prev, newCity]);
    }
    return newId;
  };

  const applyPlaceSuggestion = (s: AddressSuggestion) => {
    setName(s.placeName);
    setAddress(s.label);
    setLng(String(Math.round(s.lng * 1e6) / 1e6));
    setLat(String(Math.round(s.lat * 1e6) / 1e6));
    if (s.googleRating != null) setRating(String(s.googleRating));

    let resolvedCityId: string | undefined;
    const cc = s.countryCodeOsm?.toUpperCase();

    if (s.cityName && cc) {
      resolvedCityId = resolveCityFromCatalogOrCreate(s.cityName, cc, s);
    } else if (cc && s.localityHints.length > 0) {
      // Есть подсказки из Google, но нет locality — ищем по имени, без «ближайшего города»
      const norm = (str: string) =>
        str.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
      for (const hint of s.localityHints) {
        const match = allCities.find(
          (c) => c.countryCode.toUpperCase() === cc && norm(c.name) === norm(hint),
        );
        if (match) {
          resolvedCityId = match.id;
          break;
        }
      }
      if (!resolvedCityId) {
        resolvedCityId = resolveCityFromCatalogOrCreate(s.localityHints[0]!, cc, s);
      }
    } else {
      resolvedCityId = catalogCityIdFromPhotonHints(
        { cities: allCities, places: catalog.places },
        s.lat,
        s.lng,
        s.localityHints,
        s.countryCodeOsm,
      );
    }

    if (resolvedCityId) setCityId(resolvedCityId);

    setPlaceSearchQuery(s.placeName);
    setPlaceSuggestOpen(false);
    setPlaceSuggestions([]);
    setPlaceNoResults(false);
    setPlaceSearchDebouncing(false);
    setPlaceSearchLoading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const city = allCities.find((c) => c.id === cityId);
    const err = validateNewPlaceRequired({
      name,
      cityId,
      countryCode: city?.countryCode ?? '',
      address,
      summary,
      story,
      categories: cats,
    });
    if (err) { setError(err); return; }
    if (!city) {
      setError(t('addPlace.errorSelectFromSearch'));
      return;
    }

    // Загрузка файлов на сервер (если есть)
    let uploadedUrls: string[] = [];
    if (photoFiles.length > 0) {
      const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
      const token = new URLSearchParams(window.location.search).get('token') ?? '';
      if (base && token) {
        setPhotoUploadBusy(true);
        try {
          const fd = new FormData();
          for (const file of photoFiles) fd.append('photos', file);
          const res = await fetch(`${base.replace(/\/+$/, '')}/api/photos`, {
            method: 'POST',
            headers: { 'X-Admin-Token': token },
            body: fd,
          });
          if (res.ok) {
            const json = await res.json() as { urls: string[] };
            uploadedUrls = json.urls;
          } else {
            setError(t('addPlace.errorPhotoUpload'));
            setPhotoUploadBusy(false);
            return;
          }
        } catch (e) {
          setError(t('addPlace.errorPhotoUploadDetail', { message: e instanceof Error ? e.message : String(e) }));
          setPhotoUploadBusy(false);
          return;
        } finally {
          setPhotoUploadBusy(false);
        }
      }
    }

    const combinedPhotosRaw = [
      ...uploadedUrls,
      ...photosRaw.split(/\n+/).map((s) => s.trim()).filter(Boolean),
    ].join('\n');

    const draft = buildPlace({
      name,
      cityId,
      categories: cats,
      address,
      summary,
      story,
      lng,
      lat,
      rating,
      photosRaw: combinedPhotosRaw,
    });
    if (!draft) {
      setError(t('addPlace.errorOptionalFields'));
      return;
    }
    const place: Place = { ...draft, countryCode: city.countryCode };
    setBusy(true);
    try {
      await onSaved(place, city);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-root"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog modal-dialog--wide modal-dialog--add-place"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-place-modal-title"
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          ×
        </button>

        <h2 id="add-place-modal-title" className="modal-title">
          {t('addPlace.title')}
        </h2>
        <p className="modal-summary modal-summary--muted">
          {t('addPlace.intro')}
        </p>

        <form className="add-place-form" onSubmit={handleSubmit}>
          <label className="add-place-form__label">
            {t('addPlace.search')}
            <span className="add-place-form__hint">
              {t('addPlace.searchHint')}
            </span>
            <div className="add-place-form__autocomplete">
              <input
                className="add-place-form__input"
                value={placeSearchQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setPlaceSearchQuery(v);
                  setPlaceSuggestOpen(true);
                  if (v.trim().length < 3) {
                    setPlaceSuggestions([]);
                    setPlaceSearchLoading(false);
                    setPlaceSearchDebouncing(false);
                    setPlaceNoResults(false);
                  } else {
                    setPlaceSearchDebouncing(true);
                  }
                }}
                onFocus={() => setPlaceSuggestOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setPlaceSuggestOpen(false), 180);
                }}
                autoComplete="off"
                placeholder={t('addPlace.searchPlaceholder')}
                aria-autocomplete="list"
                aria-expanded={
                  placeSuggestOpen &&
                  placeSearchQuery.trim().length >= 3 &&
                  (placeSearchDebouncing ||
                    placeSearchLoading ||
                    placeSuggestions.length > 0 ||
                    placeNoResults)
                }
                aria-controls="add-place-photon-suggestions"
              />
              {placeSuggestOpen &&
              placeSearchQuery.trim().length >= 3 &&
              (placeSearchDebouncing ||
                placeSearchLoading ||
                placeSuggestions.length > 0 ||
                placeNoResults) ? (
                <ul
                  id="add-place-photon-suggestions"
                  className="add-place-form__suggestions"
                  role="listbox"
                >
                  {(placeSearchDebouncing ||
                    (placeSearchLoading && placeSuggestions.length === 0)) &&
                  !placeNoResults ? (
                    <li
                      className="add-place-form__suggestion add-place-form__suggestion--muted"
                      role="presentation"
                    >
                      {t('common.searching')}
                    </li>
                  ) : null}
                  {!placeSearchDebouncing &&
                  !placeSearchLoading &&
                  placeNoResults ? (
                    <li
                      className="add-place-form__suggestion add-place-form__suggestion--muted"
                      role="presentation"
                    >
                      {t('common.emptyResults')}
                    </li>
                  ) : null}
                  {placeSuggestions.map((s, i) => (
                    <li key={`${s.placeName}-${s.label}-${s.lat}-${s.lng}-${i}`} role="none">
                      <button
                        type="button"
                        className="add-place-form__suggestion"
                        role="option"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyPlaceSuggestion(s);
                        }}
                      >
                        <span className="add-place-form__suggestion-title">{s.placeName}</span>
                        <span className="add-place-form__suggestion-sub">{s.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </label>
          <label className="add-place-form__label">
            {t('addPlace.address')}
            <span className="add-place-form__hint">
              {t('addPlace.addressHint')}
            </span>
            <input
              className="add-place-form__input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              autoComplete="street-address"
            />
          </label>

          <label className="add-place-form__label">
            {t('addPlace.ratingOptional')}
            <input
              className="add-place-form__input"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              inputMode="decimal"
              placeholder="4.5"
            />
          </label>

          <fieldset className="add-place-form__fieldset">
            <legend className="add-place-form__legend">{t('addPlace.categories')}</legend>
            <div className="add-place-form__cats">
              {CATEGORY_VALUES.map((value) => (
                <label key={value} className="add-place-form__check">
                  <input
                    type="checkbox"
                    checked={cats.includes(value)}
                    onChange={() => toggleCat(value)}
                  />
                  {categoryLabel(locale, value)}
                </label>
              ))}
            </div>
          </fieldset>

         

          <label className="add-place-form__label">
            {t('addPlace.summary')}
            <input
              className="add-place-form__input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
            />
          </label>

          <label className="add-place-form__label">
            {t('addPlace.story')}
            <textarea
              className="add-place-form__textarea"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              required
              rows={4}
            />
          </label>

          <label className="add-place-form__label">
            {t('addPlace.photos')}
            <span className="add-place-form__hint">
              {t('addPlace.photosHint')}
            </span>

            {/* Загрузка файлов */}
            <div className="add-place-form__photo-upload">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="add-place-form__file-input"
                disabled={photoUploadBusy || busy}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setPhotoFiles((prev) => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
              {photoUploadBusy && (
                <span className="add-place-form__hint">{t('addPlace.uploadingFiles')}</span>
              )}
            </div>

            {/* Превью выбранных файлов */}
            {photoFiles.length > 0 && (
              <div className="add-place-form__photo-previews">
                {photoFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="add-place-form__photo-preview">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="add-place-form__photo-thumb"
                    />
                    <button
                      type="button"
                      className="add-place-form__photo-remove"
                      onClick={() => setPhotoFiles((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={t('addPlace.ariaRemovePhoto')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

           
          </label>

          {error ? <p className="add-place-form__error">{error}</p> : null}

          <div className="add-place-form__actions">
            <button type="button" className="add-place-form__btn add-place-form__btn--ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="add-place-form__btn" disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
