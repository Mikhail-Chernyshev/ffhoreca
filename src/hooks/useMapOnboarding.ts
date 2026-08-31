import { useCallback, useState } from 'react';
import type { OnboardingEvent, OnboardingHintKey } from '../lib/onboardingStore';
import {
  isHintSeen,
  isOnboardingSkipped,
  markHintSeen,
  skipAllOnboarding,
} from '../lib/onboardingStore';

const EVENT_TO_HINT: Record<OnboardingEvent, OnboardingHintKey> = {
  cityAdded: 'firstCity',
  placeAdded: 'firstPlace',
  routeAdded: 'firstRoute',
  searchUsed: 'firstSearch',
  placeOpened: 'firstPlaceOpen',
};

const HINT_MESSAGE_KEY: Record<OnboardingHintKey, string | null> = {
  showcaseBanner: null,
  firstCity: 'onboarding.hintFirstCity',
  firstPlace: 'onboarding.hintFirstPlace',
  firstRoute: 'onboarding.hintFirstRoute',
  firstSearch: 'onboarding.hintFirstSearch',
  firstPlaceOpen: 'onboarding.hintFirstPlaceOpen',
  checklistDismissed: null,
  skipAll: null,
};

export function useMapOnboarding(enabled: boolean) {
  const [skipped, setSkipped] = useState(() => isOnboardingSkipped());
  const [activeCallout, setActiveCallout] = useState<OnboardingHintKey | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [checklistCollapsed, setChecklistCollapsed] = useState(() =>
    isHintSeen('checklistDismissed'),
  );
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    isHintSeen('showcaseBanner'),
  );
  /** Bumps when a hint is marked — checklist reads localStorage and needs a re-render. */
  const [hintsVersion, setHintsVersion] = useState(0);

  const notify = useCallback(
    (event: OnboardingEvent) => {
      if (!enabled || skipped) return;
      const hint = EVENT_TO_HINT[event];
      if (isHintSeen(hint)) return;
      markHintSeen(hint);
      setHintsVersion((v) => v + 1);
      if (HINT_MESSAGE_KEY[hint]) setActiveCallout(hint);
    },
    [enabled, skipped],
  );

  const dismissCallout = useCallback(() => setActiveCallout(null), []);

  const dismissBanner = useCallback(() => {
    markHintSeen('showcaseBanner');
    setBannerDismissed(true);
  }, []);

  const dismissChecklist = useCallback(() => {
    markHintSeen('checklistDismissed');
    setChecklistCollapsed(true);
  }, []);

  const skipAll = useCallback(() => {
    skipAllOnboarding();
    setSkipped(true);
    setActiveCallout(null);
    setTourOpen(false);
    setChecklistCollapsed(true);
    setBannerDismissed(true);
  }, []);

  return {
    skipped,
    activeCallout,
    tourOpen,
    setTourOpen,
    checklistCollapsed,
    bannerDismissed,
    hintsVersion,
    notify,
    dismissCallout,
    dismissBanner,
    dismissChecklist,
    skipAll,
    calloutMessageKey: activeCallout ? HINT_MESSAGE_KEY[activeCallout] : null,
  };
}
