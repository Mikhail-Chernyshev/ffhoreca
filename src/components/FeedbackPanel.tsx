import { useCallback, useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { useT } from '../i18n/LocaleContext';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { submitFeedback } from '../lib/apiFeedback';

const FEEDBACK_EMAIL = 'tipsfromtripsapp@gmail.com';
const FEEDBACK_TELEGRAM = 'mishachernyshev';
const FEEDBACK_TELEGRAM_URL = `https://t.me/${FEEDBACK_TELEGRAM}`;

export function FeedbackPanel() {
  const t = useT();
  const { user } = useCurrentUser();
  const [expanded, setExpanded] = useState(false);
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

  const handleToggle = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  const handleLinkClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setExpanded(true);
    document.getElementById('project-feedback-details')?.scrollIntoView({ block: 'nearest' });
  }, []);

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
    <div className="world-map-feedback">
      <div className="world-map-about">
        <a
          href="#project-feedback-details"
          className="world-map-about__link"
          onClick={handleLinkClick}
        >
          {t('feedback.link')}
        </a>
        <button
          type="button"
          className={
            expanded
              ? 'world-map-about__chevron world-map-about__chevron--open'
              : 'world-map-about__chevron'
          }
          aria-expanded={expanded}
          aria-controls="project-feedback-details"
          id="project-feedback-summary"
          aria-label={expanded ? t('feedback.collapse') : t('feedback.expand')}
          onClick={handleToggle}
        >
          <span className="world-map-about__chevron-icon" aria-hidden>
            ▼
          </span>
        </button>
      </div>
      <div
        id="project-feedback-details"
        className={
          expanded
            ? 'world-map-about-details world-map-about-details--open'
            : 'world-map-about-details'
        }
        role="region"
        aria-labelledby="project-feedback-summary"
        {...(!expanded ? { 'aria-hidden': true as const } : {})}
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
    </div>
  );
}
