import { useState, useEffect, useCallback } from 'react';
import {
  fetchUserFavorites,
  searchUsers,
  addToFavorites,
  removeFromFavorites,
  type AuthUser,
} from '../lib/apiAuth';
import { useT } from '../i18n/LocaleContext';

interface Props {
  currentUser: AuthUser;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
}

export function FavoritesModal({ currentUser, onClose, onOpenProfile }: Props) {
  const t = useT();
  const [favorites, setFavorites] = useState<AuthUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AuthUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingFavs, setLoadingFavs] = useState(true);

  const loadFavorites = useCallback(async () => {
    setLoadingFavs(true);
    try {
      const favs = await fetchUserFavorites();
      setFavorites(favs);
    } finally {
      setLoadingFavs(false);
    }
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchUsers(searchQuery);
        setSearchResults(results.filter((u) => u.id !== currentUser.id));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUser.id]);

  const handleAdd = async (user: AuthUser) => {
    await addToFavorites(user.id);
    setFavorites((prev) => (prev.find((f) => f.id === user.id) ? prev : [user, ...prev]));
  };

  const handleRemove = async (userId: string) => {
    await removeFromFavorites(userId);
    setFavorites((prev) => prev.filter((f) => f.id !== userId));
  };

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

          {searchQuery.trim().length >= 2 && (
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
                    onClick={() => (isFav(u.id) ? handleRemove(u.id) : handleAdd(u))}
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
            {loadingFavs ? (
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
                    onClick={() => handleRemove(u.id)}
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
