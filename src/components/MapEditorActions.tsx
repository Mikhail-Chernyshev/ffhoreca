import { useT } from '../i18n/LocaleContext';

interface Props {
  onAddCity: () => void;
  onAddPlace: () => void;
  onAddRoute: () => void;
  onOpenManager: () => void;
}

export function MapEditorActions({ onAddCity, onAddPlace, onAddRoute, onOpenManager }: Props) {
  const t = useT();

  return (
    <div className="app-admin-actions">
      <button type="button" className="app-admin-add" onClick={onAddCity}>
        {t('app.adminAddCity')}
      </button>
      <button type="button" className="app-admin-add" onClick={onAddPlace}>
        {t('app.adminAddPlace')}
      </button>
      <button type="button" className="app-admin-add" onClick={onAddRoute}>
        {t('app.adminAddRoute')}
      </button>
      <button type="button" className="app-admin-add" onClick={onOpenManager}>
        {t('app.adminOpenManager')}
      </button>
    </div>
  );
}
