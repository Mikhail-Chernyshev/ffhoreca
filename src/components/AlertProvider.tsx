import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useT } from '../i18n/LocaleContext';

type AlertState = {
  title?: string;
  message: string;
} | null;

type AlertContextValue = {
  showAlert: (message: string, title?: string) => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

function AlertModal({
  title,
  message,
  onClose,
}: {
  title?: string;
  message: string;
  onClose: () => void;
}) {
  const t = useT();

  return (
    <div
      className="alert-modal-overlay"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="confirm-modal alert-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        aria-describedby="alert-modal-desc"
      >
        <h2 id="alert-modal-title" className="confirm-modal__title">
          {title ?? t('alert.defaultTitle')}
        </h2>
        <p id="alert-modal-desc" className="confirm-modal__text confirm-modal__text--pre">
          {message}
        </p>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__btn confirm-modal__btn--primary"
            autoFocus
            onClick={onClose}
          >
            {t('alert.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState>(null);

  const showAlert = useCallback((message: string, title?: string) => {
    setAlert({ message, title });
  }, []);

  const closeAlert = useCallback(() => setAlert(null), []);

  const value = useMemo(() => ({ showAlert }), [showAlert]);

  return (
    <AlertContext.Provider value={value}>
      {children}
      {alert ? (
        <AlertModal
          title={alert.title}
          message={alert.message}
          onClose={closeAlert}
        />
      ) : null}
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}
