import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchUserFavorites,
  searchUsers,
  addToFavorites,
  removeFromFavorites,
  type AuthUser,
} from '../lib/apiAuth';
import { useT } from '../i18n/LocaleContext';
import { queryKeys } from '../lib/queryKeys';

interface Props {
  currentUser: AuthUser;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
}

export function FavoritesModal({ currentUser, onClose, onOpenProfile }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const favoritesQuery = useQuery({
    queryKey: queryKeys.favorites,
    queryFn: fetchUserFavorites,
  });
  const favorites = favoritesQuery.data ?? [];

  const searchQueryEnabled = debouncedQuery.length >= 2;
  const searchUsersQuery = useQuery({
    queryKey: queryKeys.userSearch(debouncedQuery),
    queryFn: () => searchUsers(debouncedQuery),
    enabled: searchQueryEnabled,
  });
  const searchResults = (searchUsersQuery.data ?? []).filter(
    (u) => u.id !== currentUser.id,
  );
  const searching = searchUsersQuery.isFetching;

  const addFav = useMutation({
    mutationFn: (user: AuthUser) => addToFavorites(user.id),
    onMutate: async (user) => {
      await qc.cancelQueries({ queryKey: queryKeys.favorites });
      const prev = qc.getQueryData<AuthUser[]>(queryKeys.favorites);
      qc.setQueryData<AuthUser[]>(queryKeys.favorites, (old = []) =>
        old.some((f) => f.id === user.id) ? old : [user, ...old],
      );
      return { prev };
    },
    onError: (_e, _user, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.favorites, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });

  const removeFav = useMutation({
    mutationFn: (userId: string) => removeFromFavorites(userId),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: queryKeys.favorites });
      const prev = qc.getQueryData<AuthUser[]>(queryKeys.favorites);
      qc.setQueryData<AuthUser[]>(queryKeys.favorites, (old = []) =>
        old.filter((f) => f.id !== userId),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.favorites, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });

  const isFav = (id: string) => favorites.some((f) => f.id === id);

  return (
    <div
      className="favorites-panel-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="favorites-panel-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="favorites-panel" onClick={(e) => e.stopPropagation()}>
        <div className="favorites-panel__header">
          <h2 id="favorites-panel-title" className="favorites-panel__title">
            {t('favorites.title')}
          </h2>
          <button
            type="button"
            className="favorites-panel__close"
            onClick={onClose}
            aria-label={t('modal.close')}
          >
            ✕
          </button>
        </div>

        <div className="favorites-panel__body">
          <div className="favorites-modal__search">
            <input
              className="favorites-panel__input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('favorites.searchPlaceholder')}
            />
            {searching && <span className="favorites-modal__spinner" />}
          </div>

          {searchQueryEnabled && (
            <div className="favorites-modal__results">
              {searchResults.length === 0 && !searching && (
                <p className="favorites-modal__empty">{t('favorites.noResults')}</p>
              )}
              {searchResults.map((u) => (
                <div key={u.id} className="favorites-modal__user">
                  <UserRow user={u} onOpenProfile={onOpenProfile} />
                  <button
                    type="button"
                    className={`fav-btn ${isFav(u.id) ? 'fav-btn--active' : ''}`}
                    onClick={() =>
                      isFav(u.id) ? removeFav.mutate(u.id) : addFav.mutate(u)
                    }
                    title={isFav(u.id) ? t('favorites.remove') : t('favorites.add')}
                  >
                    {isFav(u.id) ? '★' : '☆'}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="favorites-modal__list">
            <p className="favorites-modal__section-title">{t('favorites.saved')}</p>
            {favoritesQuery.isPending ? (
              <p className="favorites-modal__empty">{t('favorites.loading')}</p>
            ) : favorites.length === 0 ? (
              <p className="favorites-modal__empty">{t('favorites.empty')}</p>
            ) : (
              favorites.map((u) => (
                <div key={u.id} className="favorites-modal__user">
                  <UserRow user={u} onOpenProfile={onOpenProfile} />
                  <button
                    type="button"
                    className="fav-btn fav-btn--active"
                    onClick={() => removeFav.mutate(u.id)}
                    title={t('favorites.remove')}
                  >
                    ★
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserRow({
  user,
  onOpenProfile,
}: {
  user: AuthUser;
  onOpenProfile: (u: string) => void;
}) {
  return (
    <button
      type="button"
      className="favorites-modal__user-btn"
      onClick={() => {
        if (user.username) onOpenProfile(user.username);
      }}
      disabled={!user.username}
    >
      {user.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className="favorites-modal__avatar"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="favorites-modal__initials">{user.name.charAt(0).toUpperCase()}</span>
      )}
      <span className="favorites-modal__user-info">
        <span className="favorites-modal__name">{user.name}</span>
        {user.username && (
          <span className="favorites-modal__username">@{user.username}</span>
        )}
      </span>
    </button>
  );
}
