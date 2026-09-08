import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/LocaleContext';
import { FeedbackPanel } from './FeedbackPanel';

export function AppFooter() {
  const t = useT();
  const footerRef = useRef<HTMLElement>(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);

  const aboutParagraphs = useMemo(
    () => [
      t('map.aboutIntro'),
      t('map.aboutLorem1'),
      t('map.aboutLorem2'),
      t('map.aboutLorem3'),
    ],
    [t],
  );

  const toggleAbout = useCallback(() => {
    setAboutExpanded((v) => !v);
    setFeedbackExpanded(false);
  }, []);

  const toggleFeedback = useCallback(() => {
    setFeedbackExpanded((v) => !v);
    setAboutExpanded(false);
  }, []);

  useLayoutEffect(() => {
    if (!aboutExpanded && !feedbackExpanded) return;
    const id = window.setTimeout(() => {
      footerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 420);
    return () => window.clearTimeout(id);
  }, [aboutExpanded, feedbackExpanded]);

  return (
    <footer className="app-footer" ref={footerRef}>
      <nav className="app-footer__nav" aria-label={t('legal.footerNav')}>
        <button
          type="button"
          className="app-footer__link app-footer__toggle"
          aria-expanded={aboutExpanded}
          aria-controls="project-about-details"
          onClick={toggleAbout}
        >
          {t('map.aboutLink')}
        </button>
        <span className="app-footer__sep" aria-hidden>·</span>
        <button
          type="button"
          className="app-footer__link app-footer__toggle"
          aria-expanded={feedbackExpanded}
          aria-controls="project-feedback-details"
          onClick={toggleFeedback}
        >
          {t('feedback.link')}
        </button>
        <span className="app-footer__sep" aria-hidden>·</span>
        <Link to="/privacy" className="app-footer__link">{t('legal.privacyLink')}</Link>
        <span className="app-footer__sep" aria-hidden>·</span>
        <Link to="/terms" className="app-footer__link">{t('legal.termsLink')}</Link>
      </nav>

      <div
        id="project-about-details"
        className={
          aboutExpanded
            ? 'world-map-about-details world-map-about-details--open'
            : 'world-map-about-details'
        }
        role="region"
        aria-label={t('map.aboutLink')}
        {...(!aboutExpanded ? { 'aria-hidden': true as const, inert: true } : {})}
      >
        <div className="world-map-about-details__inner">
          {aboutParagraphs.map((chunk, i) => (
            <p key={i} className="world-map-about-details__p">
              {chunk}
            </p>
          ))}
        </div>
      </div>

      <FeedbackPanel expanded={feedbackExpanded} />

      <p className="app-footer__copy">© Tips from trips</p>
    </footer>
  );
}
