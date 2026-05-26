import { useLocale } from '../i18n/LocaleContext';
import type { AppLocale } from '../i18n/localeStore';

export function LocaleToggle() {
  const { locale, setLocale, t } = useLocale();

  const pick = (next: AppLocale) => {
    if (next !== locale) setLocale(next);
  };

  return (
    <div className="locale-toggle" role="group" aria-label={t('locale.toggle')}>
      {(['ru', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          className={`locale-toggle__btn${locale === code ? ' locale-toggle__btn--active' : ''}`}
          aria-pressed={locale === code}
          onClick={() => pick(code)}
        >
          {t(`locale.${code}`)}
        </button>
      ))}
    </div>
  );
}
