import { useEffect, useState, type FormEvent } from 'react';
import type { Place } from '../data/types';
import type { ReportReason } from '../lib/apiReport';
import { submitPlaceReport } from '../lib/apiReport';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useT } from '../i18n/LocaleContext';

const REASONS: ReportReason[] = ['csam', 'sexual', 'violence', 'illegal', 'spam', 'other'];

type Props = {
  place: Place;
  ownerUsername: string;
  onClose: () => void;
};

export function PlaceReportDialog({ place, ownerUsername, onClose }: Props) {
  const t = useT();
  const { user } = useCurrentUser();
  const [reason, setReason] = useState<ReportReason>('illegal');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
    if (user?.name && !name) setName(user.name);
  }, [user, email, name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    if (!trimmedEmail) {
      setError(t('report.emailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t('report.emailInvalid'));
      return;
    }
    if (reason === 'other' && trimmedMessage.length < 10) {
      setError(t('report.messageRequiredForOther'));
      return;
    }

    setBusy(true);
    try {
      const result = await submitPlaceReport({
        placeId: place.id,
        placeName: place.name,
        ownerUsername,
        reason,
        email: trimmedEmail,
        name: name.trim() || undefined,
        message: trimmedMessage || undefined,
      });
      if (!result.ok) {
        setError(result.message || t('report.sendError'));
        return;
      }
      setSent(true);
    } catch {
      setError(t('report.sendError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="confirm-modal-overlay"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="place-report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-report-title"
      >
        <h2 id="place-report-title" className="place-report-dialog__title">
          {t('report.title')}
        </h2>
        <p className="place-report-dialog__subtitle">
          {t('report.subtitle', { name: place.name, username: ownerUsername })}
        </p>

        {sent ? (
          <>
            <p className="place-report-dialog__success" role="status">
              {t('report.sent')}
            </p>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--ghost"
                onClick={onClose}
              >
                {t('common.close')}
              </button>
            </div>
          </>
        ) : (
          <form className="place-report-dialog__form" onSubmit={(ev) => void handleSubmit(ev)}>
            <label className="place-report-dialog__field">
              <span>{t('report.reasonLabel')}</span>
              <select
                value={reason}
                onChange={(ev) => setReason(ev.target.value as ReportReason)}
                disabled={busy}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`report.reason.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="place-report-dialog__field">
              <span>{t('report.nameLabel')}</span>
              <input
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder={t('report.namePlaceholder')}
                maxLength={100}
                disabled={busy}
              />
            </label>
            <label className="place-report-dialog__field">
              <span>{t('report.emailLabel')}</span>
              <input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder={t('report.emailPlaceholder')}
                required
                disabled={busy}
              />
            </label>
            <label className="place-report-dialog__field">
              <span>{t('report.messageLabel')}</span>
              <textarea
                value={message}
                onChange={(ev) => setMessage(ev.target.value)}
                placeholder={t('report.messagePlaceholder')}
                rows={3}
                maxLength={2000}
                disabled={busy}
              />
            </label>
            {error ? (
              <p className="place-report-dialog__error" role="alert">{error}</p>
            ) : null}
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="confirm-modal__btn confirm-modal__btn--ghost"
                disabled={busy}
                onClick={onClose}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="confirm-modal__btn confirm-modal__btn--danger"
                disabled={busy}
              >
                {busy ? t('report.sending') : t('report.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
