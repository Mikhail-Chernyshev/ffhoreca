import { Link } from 'react-router-dom';
import type { UserSubscription } from '../data/subscription';
import { getLoginUrl } from '../lib/apiAuth';
import { useT } from '../i18n/LocaleContext';

type Props = {
  ownerName: string;
  requiredSubscription: UserSubscription;
  isLoggedIn: boolean;
};

export function MapRestrictedOverlay({ ownerName, requiredSubscription, isLoggedIn }: Props) {
  const t = useT();
  const planLabel = requiredSubscription === 'premium'
    ? t('account.planPremium')
    : t('account.planFreemium');

  return (
    <div className="map-restricted-overlay" role="status">
      <div className="map-restricted-overlay__card">
        <h2 className="map-restricted-overlay__title">
          {t('mapRestricted.title')}
        </h2>
        <p className="map-restricted-overlay__text">
          {t('mapRestricted.body', { name: ownerName, plan: planLabel })}
        </p>
        {!isLoggedIn ? (
          <button
            type="button"
            className="map-restricted-overlay__cta"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            {t('mapRestricted.login')}
          </button>
        ) : (
          <p className="map-restricted-overlay__hint">
            {t('mapRestricted.upgradeHint', { plan: planLabel })}
          </p>
        )}
        <Link to="/" className="map-restricted-overlay__back">
          ← {t('userMap.backToShowcase')}
        </Link>
      </div>
    </div>
  );
}
