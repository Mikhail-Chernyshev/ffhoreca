import { Link } from 'react-router-dom';
import { getLoginUrl } from '../lib/apiAuth';
import { rememberLoginReturnPath } from '../lib/bootstrapAuth';
import type { FollowStatus } from '../lib/apiFollow';
import { useT } from '../i18n/LocaleContext';

type Props = {
  ownerName: string;
  isLoggedIn: boolean;
  followStatus: FollowStatus;
  requestBusy?: boolean;
  requestError?: string | null;
  onRequestAccess?: () => void;
};

export function MapRestrictedOverlay({
  ownerName,
  isLoggedIn,
  followStatus,
  requestBusy = false,
  requestError = null,
  onRequestAccess,
}: Props) {
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
              {t('mapRestricted.loginHint')}
            </p>
            <button
              type="button"
              className="map-restricted-overlay__cta"
              onClick={() => {
                rememberLoginReturnPath();
                window.location.href = getLoginUrl();
              }}
            >
              {t('mapRestricted.login')}
            </button>
          </>
        ) : followStatus === 'pending' ? (
          <p className="map-restricted-overlay__hint" role="status">
            {t('mapRestricted.requestPending')}
          </p>
        ) : (
          <>
            <p className="map-restricted-overlay__hint">
              {t('mapRestricted.requestHint')}
            </p>
            <button
              type="button"
              className="map-restricted-overlay__cta"
              disabled={requestBusy || !onRequestAccess}
              onClick={onRequestAccess}
            >
              {requestBusy ? t('common.busy') : t('mapRestricted.requestAccess')}
            </button>
            {requestError ? (
              <p className="map-restricted-overlay__error" role="alert">{requestError}</p>
            ) : null}
          </>
        )}
        <Link to="/" className="map-restricted-overlay__back">
          ← {t('userMap.backToShowcase')}
        </Link>
      </div>
    </div>
  );
}
