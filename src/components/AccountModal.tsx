import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AuthUser, UserUsage } from '../lib/apiAuth';
import {
  fetchAuthAccount,
  setUsername,
  updateAccountSettings,
  deleteAccount,
} from '../lib/apiAuth';
import {
  FREEMIUM_LIMITS,
  FREEMIUM_LIMITS_ENFORCED,
  type MapVisibility,
  type UserSubscription,
} from '../data/subscription';
import { useT } from '../i18n/LocaleContext';
import { mapShareUrl } from '../lib/shareUrl';
import { isReservedUsername } from '../lib/reservedUsernames';
import { ConfirmModal } from './ConfirmModal';

type Props = {
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onAccountDeleted: () => void;
};

export function AccountModal({
  user,
  onClose,
  onUserUpdated,
  onAccountDeleted,
}: Props) {
  const t = useT();
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [mapVisibility, setMapVisibility] = useState<MapVisibility>(
    user.map_visibility,
  );
  const [usernameDraft, setUsernameDraft] = useState(user.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    setUsernameDraft(user.username ?? '');
  }, [user.username]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAuthAccount()
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError(t('account.loadError'));
          return;
        }
        setUsage(data.usage);
        setMapVisibility(data.user.map_visibility);
      })
      .catch(() => {
        if (!cancelled) setError(t('account.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const saveVisibility = async (next: MapVisibility) => {
    setMapVisibility(next);
    setSettingsBusy(true);
    setError(null);
    try {
      const data = await updateAccountSettings(next);
      setUsage(data.usage);
      onUserUpdated(data.user);
    } catch (e) {
      setMapVisibility(user.map_visibility);
      setError(e instanceof Error ? e.message : t('account.saveError'));
    } finally {
      setSettingsBusy(false);
    }
  };

  const saveUsername = async () => {
    const trimmed = usernameDraft.trim().toLowerCase();
    if (!trimmed) {
      setUsernameError(t('auth.usernameRequired'));
      return;
    }
    if (isReservedUsername(trimmed)) {
      setUsernameError(t('auth.usernameReserved'));
      return;
    }
    if (trimmed === (user.username ?? '').toLowerCase()) return;

    setUsernameSaving(true);
    setUsernameError(null);
    setError(null);
    try {
      const updated = await setUsername(trimmed);
      setUsernameDraft(updated.username ?? trimmed);
      onUserUpdated(updated);
    } catch (e) {
      setUsernameError(
        e instanceof Error ? e.message : t('auth.usernameSaveError'),
      );
    } finally {
      setUsernameSaving(false);
    }
  };

  const usernameChanged =
    usernameDraft.trim().toLowerCase() !== (user.username ?? '').toLowerCase();
  const subscription = user.subscription;

  const handleDeleteAccount = async () => {
    setDeleteBusy(true);
    setError(null);
    try {
      await deleteAccount();
      setDeleteConfirmOpen(false);
      onAccountDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('account.deleteError'));
      setDeleteConfirmOpen(false);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div
      className='modal-root'
      role='presentation'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className='modal-dialog modal-dialog--wide account-modal'
        role='dialog'
        aria-modal='true'
        aria-labelledby='account-modal-title'
      >
        <button
          type='button'
          className='modal-close'
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>

        <div className='modal-dialog__scroll'>
          <h2 id='account-modal-title' className='modal-title'>
            {t('account.title')}
          </h2>

          <div className='account-modal__profile'>
            {user.avatar ? (
              <img
                src={user.avatar}
                alt=''
                className='account-modal__avatar'
                referrerPolicy='no-referrer'
              />
            ) : (
              <span className='account-modal__initials'>
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className='account-modal__profile-text'>
              <p className='account-modal__name'>{user.name}</p>
              {user.email ? (
                <p className='account-modal__email'>{user.email}</p>
              ) : null}
            </div>
          </div>

          <section className='account-modal__section'>
            <h3 className='account-modal__section-title'>
              {t('account.usernameTitle')} ({t('auth.usernameHint')})
            </h3>
            <div className='account-modal__username-row'>
              <div className='modal__field account-modal__username-field'>
                <span className='username-modal__prefix'>@</span>
                <input
                  className='modal__input username-modal__input'
                  type='text'
                  value={usernameDraft}
                  onChange={(e) => {
                    setUsernameDraft(e.target.value);
                    setUsernameError(null);
                  }}
                  placeholder={t('auth.usernamePlaceholder')}
                  maxLength={30}
                  autoFocus={!user.username}
                  disabled={usernameSaving || settingsBusy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveUsername();
                  }}
                />
              </div>
              <button
                type='button'
                className='account-modal__save-btn'
                disabled={!usernameChanged || usernameSaving || settingsBusy}
                onClick={() => void saveUsername()}
              >
                {usernameSaving ? t('auth.saving') : t('auth.save')}
              </button>
              <button
                type='button'
                className='account-modal__share-btn'
                disabled={settingsBusy || usernameSaving || !user.username}
                onClick={() => {
                  if (!user.username) return;
                  void navigator.clipboard
                    .writeText(mapShareUrl(user.username))
                    .then(() => {
                      setShareCopied(true);
                      window.setTimeout(() => setShareCopied(false), 2000);
                    });
                }}
              >
                {shareCopied
                  ? t('account.shareLinkCopied')
                  : t('account.copyShareLink')}
              </button>
            </div>
            {usernameError ? (
              <p
                className='account-modal__error account-modal__error--field'
                role='alert'
              >
                {usernameError}
              </p>
            ) : null}
          </section>

          <section className='account-modal__section'>
            <h3 className='account-modal__section-title'>
              {t('account.subscriptionTitle')}
            </h3>
            {!FREEMIUM_LIMITS_ENFORCED ? (
              <p className='account-modal__beta-note' role='status'>
                {t('account.limitsBetaNote')}
              </p>
            ) : null}
            <div className='account-modal__plans'>
              <PlanCard
                plan='freemium'
                active={subscription === 'freemium'}
                t={t}
                usage={usage}
                loading={loading}
              />
              <PlanCard
                plan='premium'
                active={subscription === 'premium'}
                t={t}
                usage={usage}
                loading={loading}
              />
            </div>
          </section>

          <section className='account-modal__section'>
            <h3 className='account-modal__section-title'>
              {t('account.visibilityTitle')}
            </h3>
            <p className='account-modal__hint'>{t('account.visibilityHint')}</p>
            <div className='account-modal__visibility'>
              <label className='account-modal__radio'>
                <input
                  type='radio'
                  name='map_visibility'
                  checked={mapVisibility === 'public'}
                  disabled={settingsBusy || usernameSaving}
                  onChange={() => void saveVisibility('public')}
                />
                <span>
                  <strong>{t('account.visibilityPublic')}</strong>
                  <small>{t('account.visibilityPublicHint')}</small>
                </span>
              </label>
              <label className='account-modal__radio'>
                <input
                  type='radio'
                  name='map_visibility'
                  checked={mapVisibility === 'subscribers'}
                  disabled={settingsBusy || usernameSaving}
                  onChange={() => void saveVisibility('subscribers')}
                />
                <span>
                  <strong>{t('account.visibilitySubscribers')}</strong>
                  <small>{t('account.visibilitySubscribersHint')}</small>
                </span>
              </label>
            </div>
          </section>

          <section className='account-modal__section account-modal__section--danger'>
            <h3 className='account-modal__section-title'>
              {t('account.deleteTitle')}
            </h3>
            <p className='account-modal__hint'>{t('account.deleteHint')}</p>
            <button
              type='button'
              className='account-modal__delete-btn'
              disabled={settingsBusy || usernameSaving || deleteBusy}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              {t('account.deleteButton')}
            </button>
          </section>

          <p className='account-modal__legal'>
            <Link to='/privacy' onClick={onClose}>
              {t('legal.privacyLink')}
            </Link>
            <span aria-hidden> · </span>
            <Link to='/terms' onClick={onClose}>
              {t('legal.termsLink')}
            </Link>
          </p>

          {error ? (
            <p className='account-modal__error' role='alert'>
              {error}
            </p>
          ) : null}
          {settingsBusy ? (
            <p className='account-modal__busy'>{t('common.busy')}</p>
          ) : null}
        </div>
      </div>

      {deleteConfirmOpen ? (
        <ConfirmModal
          title={t('account.deleteConfirmTitle')}
          message={t('account.deleteConfirmMessage')}
          confirmLabel={t('account.deleteButton')}
          busy={deleteBusy}
          onConfirm={() => void handleDeleteAccount()}
          onCancel={() => {
            if (!deleteBusy) setDeleteConfirmOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function PlanCard({
  plan,
  active,
  t,
  usage,
  loading,
}: {
  plan: UserSubscription;
  active: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  usage: UserUsage | null;
  loading: boolean;
}) {
  const isFreemium = plan === 'freemium';
  const limitsActive = FREEMIUM_LIMITS_ENFORCED;

  return (
    <div
      className={active ? 'account-plan account-plan--active' : 'account-plan'}
    >
      {active ? (
        <span className='account-plan__badge'>{t('account.currentPlan')}</span>
      ) : null}
      <h4 className='account-plan__name'>
        {isFreemium ? t('account.planFreemium') : t('account.planPremium')}
      </h4>
      <p className='account-plan__price'>
        {isFreemium
          ? t('account.planFreemiumPrice')
          : t('account.planPremiumPrice')}
      </p>
      {!isFreemium && (
        <ul className='account-plan__features'>
          <li>{t('account.premiumUnlimitedCountries')}</li>
          <li>{t('account.premiumUnlimitedCities')}</li>
          <li>{t('account.premiumUnlimitedRoutes')}</li>
          <li>{t('account.premiumUnlimitedPlaces')}</li>
        </ul>
      )}
      {active && isFreemium && usage && !loading ? (
        <ul className='account-plan__features'>
          {limitsActive ? (
            <>
              <li>
                {t('account.usageCountries', {
                  used: usage.countries,
                  max: FREEMIUM_LIMITS.countries,
                })}
              </li>
              <li>
                {t('account.usageCities', {
                  used: usage.cities,
                  max: FREEMIUM_LIMITS.cities,
                })}
              </li>
              <li>
                {t('account.usageRoutes', {
                  used: usage.routes,
                  max: FREEMIUM_LIMITS.routes,
                })}
              </li>
              <li>
                {t('account.usagePlaces', {
                  used: usage.places,
                  max: FREEMIUM_LIMITS.places,
                })}
              </li>
            </>
          ) : (
            <>
              <li>
                {t('account.usageCountriesOnly', { used: usage.countries })}
              </li>
              <li>{t('account.usageCitiesOnly', { used: usage.cities })}</li>
              <li>{t('account.usageRoutesOnly', { used: usage.routes })}</li>
              <li>{t('account.usagePlacesOnly', { used: usage.places })}</li>
            </>
          )}
        </ul>
      ) : null}
      {!isFreemium ? (
        <button type='button' className='account-plan__cta' disabled>
          {t('account.comingSoon')}
        </button>
      ) : null}
    </div>
  );
}
