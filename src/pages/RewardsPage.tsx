import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AccountModal } from '../components/AccountModal';
import { AdminUsersModal } from '../components/AdminUsersModal';
import { AppFooter } from '../components/AppFooter';
import { AppHeader } from '../components/AppHeader';
import { AuthButton } from '../components/AuthButton';
import { FavoritesModal } from '../components/FavoritesModal';
import { RewardSeal } from '../components/RewardSeal';
import { useAdminMode } from '../hooks/useAdminMode';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useFollowers } from '../hooks/useFollowers';
import { useT } from '../i18n/LocaleContext';
import { fetchUserTravelData } from '../lib/apiUserCatalog';
import { transitSet } from '../lib/transitCountries';
import {
  collectRewardStats,
  evaluateRewards,
  REWARD_GROUP_ORDER,
  type RewardGroup,
  type RewardId,
  type RewardProgress,
} from '../lib/rewards';
import { WORLD_COUNTRY_COUNT } from '../lib/travelPassport';
import { queryKeys } from '../lib/queryKeys';
import './RewardsPage.css';

export function RewardsPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, logout, refetch } = useCurrentUser();
  const adminMode = useAdminMode(user?.email);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [adminUsersOpen, setAdminUsersOpen] = useState(false);

  const username = user?.username ?? null;
  const { followers } = useFollowers(Boolean(user));
  const travelQuery = useQuery({
    queryKey: queryKeys.userTravel(username ?? ''),
    queryFn: () => fetchUserTravelData(username!),
    enabled: Boolean(username),
  });

  const transit = useMemo(
    () => transitSet(user?.transit_countries ?? []),
    [user?.transit_countries],
  );

  const stats = useMemo(() => {
    const catalog = travelQuery.data?.catalog ?? { cities: [], places: [] };
    const routes = travelQuery.data?.routes ?? [];
    return collectRewardStats(catalog, routes, transit, {
      followers: followers.length,
    });
  }, [travelQuery.data, transit, followers.length]);

  const progress = useMemo(() => evaluateRewards(stats), [stats]);
  const unlockedCount = progress.filter((item) => item.unlocked).length;
  const liveTotal = progress.filter((item) => !item.comingSoon).length;
  const grouped = useMemo(() => groupRewards(progress), [progress]);

  return (
    <div className="rewards-page">
      <AppHeader
        tagline={t('app.tagline')}
        right={
          <AuthButton
            user={user}
            loading={authLoading}
            onLogout={logout}
            onOpenFavorites={() => setFavoritesOpen(true)}
            onOpenAccount={() => setAccountOpen(true)}
            isAdmin={adminMode}
            onOpenAdminUsers={() => setAdminUsersOpen(true)}
          />
        }
      />

      <main className="rewards-page__main">
        <button
          type="button"
          className="legal-page__back rewards-page__back"
          onClick={() => {
            if (location.key !== 'default') navigate(-1);
            else navigate('/');
          }}
        >
          {t('rewards.back')}
        </button>
        <h1 className="rewards-page__title">{t('rewards.title')}</h1>
        <p className="rewards-page__intro">
          {username ? t('rewards.intro') : t('rewards.introGuest')}
        </p>

        <div className="rewards-ledger">
          <p className="rewards-page__opened">
            {t('rewards.opened', { done: unlockedCount, total: liveTotal })}
          </p>
          <div className="rewards-coverage">
            <span className="rewards-coverage__meta">
              {t('rewards.coverage', {
                count: stats.countries,
                total: WORLD_COUNTRY_COUNT,
              })}
            </span>
            <span className="rewards-coverage__bar" aria-hidden>
              <span
                className="rewards-coverage__fill"
                style={{
                  width: `${Math.min(100, (stats.countries / WORLD_COUNTRY_COUNT) * 100)}%`,
                }}
              />
            </span>
          </div>
        </div>

        {travelQuery.isLoading && username ? (
          <p className="rewards-page__intro">{t('common.loading')}</p>
        ) : (
          grouped.map(({ group, items }) => (
            <section key={group} className="rewards-group">
              <h2 className="rewards-group__title">{t(`rewards.groups.${group}`)}</h2>
              <ul className="rewards-grid">
                {items.map((item) => {
                  const title = t(titleKey(item.id));
                  const hint = t(hintKey(item.id));
                  const progressLabel = item.comingSoon
                    ? t('rewards.soon')
                    : t('rewards.progress', {
                        current: Math.min(item.current, item.target),
                        target: item.target,
                      });
                  const state = item.comingSoon ? 'soon' : item.unlocked ? 'on' : 'off';
                  return (
                    <li
                      key={item.id}
                      className={`reward-card reward-card--${state}`}
                      aria-label={`${title}. ${hint}. ${progressLabel}`}
                    >
                      <RewardSeal
                        id={item.id}
                        unlocked={item.unlocked}
                        comingSoon={item.comingSoon}
                        current={item.current}
                        target={item.target}
                        soonLabel={t('rewards.soon')}
                      />
                      <span className="reward-card__name">{title}</span>
                      <span className="reward-card__hint">{hint}</span>
                      <span className="reward-card__progress">{progressLabel}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </main>

      <AppFooter />

      {favoritesOpen && user ? (
        <FavoritesModal
          currentUser={user}
          onClose={() => setFavoritesOpen(false)}
          onOpenProfile={(name) => {
            setFavoritesOpen(false);
            navigate(`/${name}`);
          }}
        />
      ) : null}
      {adminUsersOpen && adminMode ? (
        <AdminUsersModal
          onClose={() => setAdminUsersOpen(false)}
          onOpenProfile={(name) => {
            setAdminUsersOpen(false);
            navigate(`/${name}`);
          }}
        />
      ) : null}
      {accountOpen && user ? (
        <AccountModal
          user={user}
          onClose={() => setAccountOpen(false)}
          onUserUpdated={(updated) => {
            void refetch();
            if (
              updated.username &&
              updated.username.toLowerCase() !== (user.username ?? '').toLowerCase()
            ) {
              navigate(`/${updated.username}`);
            }
          }}
          onAccountDeleted={() => {
            setAccountOpen(false);
            logout();
            navigate('/');
          }}
        />
      ) : null}
    </div>
  );
}

function groupRewards(progress: RewardProgress[]): { group: RewardGroup; items: RewardProgress[] }[] {
  return REWARD_GROUP_ORDER.flatMap((group) => {
    const items = progress.filter((item) => item.group === group);
    return items.length ? [{ group, items }] : [];
  });
}

function titleKey(id: RewardId): string {
  return `rewards.items.${id}.title`;
}

function hintKey(id: RewardId): string {
  return `rewards.items.${id}.hint`;
}
