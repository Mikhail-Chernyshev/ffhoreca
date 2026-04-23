import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Catalog, Place, PlaceCategory } from '../data/types';
import { cityById } from '../data/selectors';

type Props = {
  onClose: () => void;
  catalog: Catalog;
  onSaved: (place: Place) => void | Promise<void>;
};

const CATEGORIES: PlaceCategory[] = ['lodging', 'food', 'bar', 'airport'];

const defaultPhoto = () =>
  `https://picsum.photos/seed/ffh-admin-${Date.now()}/900/560`;

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
  const photos = lines.length > 0 ? lines : [defaultPhoto()];

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
  const [name, setName] = useState('');
  const [cityId, setCityId] = useState(catalog.cities[0]?.id ?? '');
  const [cats, setCats] = useState<PlaceCategory[]>(['food']);
  const [address, setAddress] = useState('');
  const [summary, setSummary] = useState('');
  const [story, setStory] = useState('');
  const [lng, setLng] = useState('');
  const [lat, setLat] = useState('');
  const [rating, setRating] = useState('');
  const [photosRaw, setPhotosRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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
      photosRaw,
    });
    if (!draft) {
      setError('Заполните обязательные поля и выберите хотя бы одну категорию.');
      return;
    }
    const city = cityById(catalog, draft.cityId);
    if (!city) {
      setError('Город не найден в каталоге.');
      return;
    }
    const place: Place = { ...draft, countryCode: city.countryCode };
    setBusy(true);
    try {
      await onSaved(place);
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
        className="modal-dialog modal-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-place-modal-title"
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <h2 id="add-place-modal-title" className="modal-title">
          Новое место
        </h2>
        <p className="modal-summary modal-summary--muted">
          Попадёт на карту и в поиск; дублируется в localStorage браузера. При настроенном API —
          дополнительно отправится на сервер (токен из URL).
        </p>

        <form className="add-place-form" onSubmit={handleSubmit}>
          <label className="add-place-form__label">
            Название
            <input
              className="add-place-form__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </label>

          <label className="add-place-form__label">
            Город
            <select
              className="add-place-form__input"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              required
            >
              {catalog.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="add-place-form__fieldset">
            <legend className="add-place-form__legend">Категории</legend>
            <div className="add-place-form__cats">
              {CATEGORIES.map((c) => (
                <label key={c} className="add-place-form__check">
                  <input
                    type="checkbox"
                    checked={cats.includes(c)}
                    onChange={() => toggleCat(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="add-place-form__label">
            Адрес
            <input
              className="add-place-form__input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </label>

          <label className="add-place-form__label">
            Кратко (summary)
            <input
              className="add-place-form__input"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
            />
          </label>

          <label className="add-place-form__label">
            История / впечатления
            <textarea
              className="add-place-form__textarea"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              required
              rows={4}
            />
          </label>

          <div className="add-place-form__row">
            <label className="add-place-form__label add-place-form__label--half">
              Долгота (необяз.)
              <input
                className="add-place-form__input"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                inputMode="decimal"
                placeholder="100.88"
              />
            </label>
            <label className="add-place-form__label add-place-form__label--half">
              Широта (необяз.)
              <input
                className="add-place-form__input"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                inputMode="decimal"
                placeholder="12.93"
              />
            </label>
          </div>

          <label className="add-place-form__label">
            Оценка Google (0–5, необяз.)
            <input
              className="add-place-form__input"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              inputMode="decimal"
              placeholder="4.5"
            />
          </label>

          <label className="add-place-form__label">
            Фото — URL по одному на строку (пусто = placeholder)
            <textarea
              className="add-place-form__textarea add-place-form__textarea--short"
              value={photosRaw}
              onChange={(e) => setPhotosRaw(e.target.value)}
              rows={3}
              placeholder="https://…"
            />
          </label>

          {error ? <p className="add-place-form__error">{error}</p> : null}

          <div className="add-place-form__actions">
            <button type="button" className="add-place-form__btn add-place-form__btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="add-place-form__btn" disabled={busy}>
              {busy ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
