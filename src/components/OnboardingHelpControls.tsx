import { useT } from '../i18n/LocaleContext';

interface Props {
  onOpenTour: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
}

export function OnboardingHelpControls({ onOpenTour, onSkip, showSkip }: Props) {
  const t = useT();

  return (
    <div className="onboarding-help-controls">
      <button type="button" className="onboarding-help-btn" onClick={onOpenTour}>
        {t('onboarding.helpButton')}
      </button>
      {showSkip && onSkip ? (
        <button type="button" className="onboarding-skip-btn" onClick={onSkip}>
          {t('onboarding.skipTour')}
        </button>
      ) : null}
    </div>
  );
}
