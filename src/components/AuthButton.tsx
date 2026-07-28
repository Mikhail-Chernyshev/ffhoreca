import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AuthUser } from '../lib/apiAuth';
import { getLoginUrl } from '../lib/apiAuth';
import { useT } from '../i18n/LocaleContext';
import { apiBaseUrl } from '../lib/apiBase';
import { OverflowMarqueeText } from './OverflowMarqueeText';
import { ConfirmModal } from './ConfirmModal';

function LogoutIcon() {
  return (
    <svg
      className="auth-user__logout-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

interface Props {
  user: AuthUser | null;
  loading: boolean;
  onLogout: () => void;
  onOpenFavorites: () => void;
  onOpenAccount: () => void;
  /** Админ витрины — кнопка списка всех пользователей */
  isAdmin?: boolean;
  onOpenAdminUsers?: () => void;
}

export function AuthButton({
  user,
  loading,
  onLogout,
  onOpenFavorites,
  onOpenAccount,
  isAdmin = false,
  onOpenAdminUsers,
}: Props) {
  const t = useT();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  if (!apiBaseUrl()) return null;

  if (loading) {
    return <div className="auth-btn auth-btn--loading" aria-label={t('auth.loading')} />;
  }

  if (!user) {
    return (
      <button
        className="auth-btn auth-btn--login"
        onClick={() => { window.location.href = getLoginUrl(); }}
        title={t('auth.loginWithGoogle')}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.5 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.5-2.9-11.3-7.1l-6.6 5.1C9.8 39.6 16.4 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.5-4.6 5.9l6.2 5.2C40.7 35.4 44 30.1 44 24c0-1.3-.1-2.7-.4-4z"/>
        </svg>
        {t('auth.login')}
      </button>
    );
  }

  const displayName = user.username ? `@${user.username}` : user.name;

  const nameEl = (
    <>
      {user.avatar
        ? <img src={user.avatar} alt={user.name} className="auth-user__avatar" referrerPolicy="no-referrer" />
        : <span className="auth-user__initials">{user.name.charAt(0).toUpperCase()}</span>
      }
      <OverflowMarqueeText className="auth-user__name-label" title={displayName}>
        {displayName}
      </OverflowMarqueeText>
    </>
  );

  return (
    <div className="auth-user">
      <div className="auth-user__row">
        {isAdmin && onOpenAdminUsers ? (
          <button
            type="button"
            className="auth-user__admin-users"
            onClick={onOpenAdminUsers}
            title={t('adminUsers.open')}
            aria-label={t('adminUsers.open')}
          >
            {t('adminUsers.button')}
          </button>
        ) : null}
        <button
          type="button"
          className="auth-user__favorites"
          onClick={onOpenFavorites}
          title={t('auth.favorites')}
        >
          ★
        </button>
        {user.username
          ? (
            <Link
              to={`/${user.username}`}
              className="auth-user__name auth-user__name--link"
              title={t('auth.myMap')}
            >
              {nameEl}
            </Link>
          )
          : (
            <span className="auth-user__name" title={user.email ?? user.name}>
              {nameEl}
            </span>
          )
        }
        <button
          type="button"
          className="auth-user__logout"
          onClick={() => setLogoutConfirmOpen(true)}
          title={t('auth.logout')}
          aria-label={t('auth.logout')}
        >
          <LogoutIcon />
          <span className="auth-user__logout-label">{t('auth.logout')}</span>
        </button>
      </div>
      <button
        type="button"
        className="onboarding-help-btn auth-user__account"
        onClick={onOpenAccount}
      >
        {t('auth.account')}
      </button>

      {logoutConfirmOpen ? (
        <ConfirmModal
          title={t('auth.logoutConfirmTitle')}
          message={t('auth.logoutConfirmMessage')}
          confirmLabel={t('auth.logout')}
          onConfirm={() => {
            setLogoutConfirmOpen(false);
            onLogout();
          }}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
      ) : null}
    </div>
  );
}
