import { Link } from 'react-router-dom';
import { getLoginUrl } from '../lib/apiAuth';
import { useT } from '../i18n/LocaleContext';

type Props = {
  ownerName: string;
  isLoggedIn: boolean;
};

export function MapRestrictedOverlay({ ownerName, isLoggedIn }: Props) {
  const t = useT();

  return (
    <div className="map-restricted-overlay" role="status">
      <div className="map-restricted-overlay__card">
        <h2 className="map-restricted-overlay__title">
          {t('mapRestricted.title')}
        </h2>
        <p className="map-restricted-overlay__text">
          {t('mapRestricted.body', { name: ownerName })}
        </p>
        {!isLoggedIn ? (
          <>
            <p className="map-restricted-overlay__hint">
              {t('mapRestricted.ownerLoginHint')}
            </p>
            <button
              type="button"
              className="map-restricted-overlay__cta"
              onClick={() => { window.location.href = getLoginUrl(); }}
            >
              {t('mapRestricted.login')}
            </button>
          </>
        ) : null}
        <Link to="/" className="map-restricted-overlay__back">
          ← {t('userMap.backToShowcase')}
        </Link>
      </div>
    </div>
  );
}
