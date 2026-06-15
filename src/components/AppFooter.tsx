import { Link } from 'react-router-dom';
import { useT } from '../i18n/LocaleContext';

export function AppFooter() {
  const t = useT();

  return (
    <footer className="app-footer">
      <nav className="app-footer__nav" aria-label={t('legal.footerNav')}>
        <Link to="/privacy" className="app-footer__link">{t('legal.privacyLink')}</Link>
        <span className="app-footer__sep" aria-hidden>·</span>
        <Link to="/terms" className="app-footer__link">{t('legal.termsLink')}</Link>
      </nav>
      <p className="app-footer__copy">© Tips from trips</p>
    </footer>
  );
}
