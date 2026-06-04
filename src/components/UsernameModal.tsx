import { useState } from 'react';
import { setUsername, type AuthUser } from '../lib/apiAuth';
import { useT } from '../i18n/LocaleContext';

interface Props {
  user: AuthUser;
  onSave: (updated: AuthUser) => void;
  onSkip: () => void;
}

export function UsernameModal({ user, onSave, onSkip }: Props) {
  const t = useT();
  const [value, setValue] = useState(user.username ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) { setError(t('auth.usernameRequired')); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await setUsername(trimmed);
      onSave(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.usernameSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('auth.pickUsername')}>
      <div className="modal username-modal">
        <h2 className="modal__title">{t('auth.pickUsername')}</h2>
        <p className="modal__hint">{t('auth.usernameHint')}</p>

        <div className="modal__field">
          <span className="username-modal__prefix">@</span>
          <input
            className="modal__input username-modal__input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('auth.usernamePlaceholder')}
            maxLength={30}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
          />
        </div>

        {error && <p className="modal__error">{error}</p>}

        <div className="modal__actions">
          <button className="modal__btn modal__btn--secondary" onClick={onSkip}>
            {t('auth.skipForNow')}
          </button>
          <button className="modal__btn modal__btn--primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('auth.saving') : t('auth.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
