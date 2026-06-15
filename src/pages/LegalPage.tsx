import { Link } from 'react-router-dom';
import { getLegalDocument } from '../content/legal';
import { useLocale, useT } from '../i18n/LocaleContext';

type Props = {
  kind: 'privacy' | 'terms';
};

export function LegalPage({ kind }: Props) {
  const { locale } = useLocale();
  const t = useT();
  const doc = getLegalDocument(locale, kind);

  return (
    <div className="legal-page">
      <div className="legal-page__inner">
        <Link to="/" className="legal-page__back">
          {t('legal.backHome')}
        </Link>
        <h1 className="legal-page__title">{doc.title}</h1>
        <p className="legal-page__updated">{t('legal.updated', { date: doc.updated })}</p>
        {doc.sections.map((section) => (
          <section key={section.heading} className="legal-page__section">
            <h2 className="legal-page__heading">{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p} className="legal-page__p">{p}</p>
            ))}
          </section>
        ))}
        <footer className="legal-page__footer">
          {kind === 'privacy' ? (
            <Link to="/terms">{t('legal.termsLink')}</Link>
          ) : (
            <Link to="/privacy">{t('legal.privacyLink')}</Link>
          )}
        </footer>
      </div>
    </div>
  );
}
