import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAdminUsers,
  type AdminUserListItem,
} from '../lib/apiAuth';
import { useT } from '../i18n/LocaleContext';

type Props = {
  onClose: () => void;
  onOpenProfile: (username: string) => void;
};

export function AdminUsersModal({ onClose, onOpenProfile }: Props) {
  const t = useT();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAdminUsers();
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [u.username ?? '', u.name, u.email ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [users, query]);

  return (
    <div
      className="favorites-panel-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-users-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="favorites-panel" onClick={(e) => e.stopPropagation()}>
        <div className="favorites-panel__header">
          <h2 id="admin-users-title" className="favorites-panel__title">
            {t('adminUsers.title', { count: users.length })}
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('adminUsers.searchPlaceholder')}
              autoFocus
            />
          </div>

          {loading ? (
            <p className="favorites-modal__empty">{t('adminUsers.loading')}</p>
          ) : error ? (
            <p className="favorites-modal__empty" role="alert">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="favorites-modal__empty">{t('adminUsers.empty')}</p>
          ) : (
            <div className="favorites-modal__list">
              {filtered.map((u) => (
                <div key={u.id} className="favorites-modal__user">
                  <button
                    type="button"
                    className="favorites-modal__user-btn"
                    onClick={() => {
                      if (u.username) onOpenProfile(u.username);
                    }}
                    disabled={!u.username}
                    title={u.username ? `@${u.username}` : t('adminUsers.noUsername')}
                  >
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="favorites-modal__avatar"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="favorites-modal__initials">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="favorites-modal__user-info">
                      <span className="favorites-modal__name">{u.name}</span>
                      <span className="favorites-modal__username">
                        {u.username ? `@${u.username}` : t('adminUsers.noUsername')}
                        {u.email ? ` · ${u.email}` : ''}
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
