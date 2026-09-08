import { useEffect, useState, type FormEvent } from 'react';
import { useT } from '../i18n/LocaleContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { submitFeedback } from '../lib/apiFeedback';

const FEEDBACK_EMAIL = 'tipsfromtripsapp@gmail.com';
const FEEDBACK_TELEGRAM = 'mishachernyshev';
const FEEDBACK_TELEGRAM_URL = `https://t.me/${FEEDBACK_TELEGRAM}`;

type Props = {
  expanded: boolean;
};

export function FeedbackPanel({ expanded }: Props) {
  const t = useT();
  const { user } = useCurrentUser();
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSent(false);

    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    if (!trimmedEmail) {
      setError(t('feedback.emailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t('feedback.emailInvalid'));
      return;
    }
    if (trimmedMessage.length < 10) {
      setError(t('feedback.messageTooShort'));
      return;
    }

    setBusy(true);
    try {
      const result = await submitFeedback({
        name: name.trim() || undefined,
        email: trimmedEmail,
        message: trimmedMessage,
      });
      if (!result.ok) {
        setError(result.message || t('feedback.sendError'));
        return;
      }
      setSent(true);
      setMessage('');
    } catch {
      setError(t('feedback.sendError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      id="project-feedback-details"
      className={
        expanded
          ? 'world-map-about-details world-map-about-details--open'
          : 'world-map-about-details'
      }
      role="region"
      aria-label={t('feedback.link')}
      {...(!expanded ? { 'aria-hidden': true as const, inert: true } : {})}
    >
      <div className="world-map-feedback__inner">
        <p className="world-map-feedback__intro">{t('feedback.intro')}</p>
        <ul className="world-map-feedback__contacts">
          <li>
            <span className="world-map-feedback__contact-label">{t('feedback.emailLabel')}</span>
            <a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>
          </li>
          <li>
            <span className="world-map-feedback__contact-label">{t('feedback.telegramLabel')}</span>
            <a
              href={FEEDBACK_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              @{FEEDBACK_TELEGRAM}
            </a>
          </li>
        </ul>

        <form className="world-map-feedback__form" onSubmit={(ev) => void handleSubmit(ev)}>
          <h3 className="world-map-feedback__form-title">{t('feedback.formTitle')}</h3>
          <label className="world-map-feedback__field">
            <span>{t('feedback.nameLabel')}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('feedback.namePlaceholder')}
              maxLength={100}
              disabled={busy}
            />
          </label>
          <label className="world-map-feedback__field">
            <span>{t('feedback.emailFieldLabel')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('feedback.emailPlaceholder')}
              required
              disabled={busy}
            />
          </label>
          <label className="world-map-feedback__field">
            <span>{t('feedback.messageLabel')}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('feedback.messagePlaceholder')}
              rows={4}
              maxLength={5000}
              required
              disabled={busy}
            />
          </label>
          {error ? (
            <p className="world-map-feedback__error" role="alert">{error}</p>
          ) : null}
          {sent ? (
            <p className="world-map-feedback__success" role="status">{t('feedback.sent')}</p>
          ) : null}
          <button type="submit" className="world-map-feedback__submit" disabled={busy}>
            {busy ? t('feedback.sending') : t('feedback.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
