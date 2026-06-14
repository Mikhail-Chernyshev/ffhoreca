const STORAGE_KEY = 'ffhoreca_onboarding_v1';

export type OnboardingHintKey =
  | 'showcaseBanner'
  | 'firstCity'
  | 'firstPlace'
  | 'firstRoute'
  | 'firstSearch'
  | 'firstPlaceOpen'
  | 'checklistDismissed'
  | 'skipAll';

export type OnboardingEvent =
  | 'cityAdded'
  | 'placeAdded'
  | 'routeAdded'
  | 'searchUsed'
  | 'placeOpened';

interface OnboardingState {
  seen: Partial<Record<OnboardingHintKey, true>>;
}

function readState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { seen: {} };
    const parsed = JSON.parse(raw) as OnboardingState;
    return { seen: parsed.seen ?? {} };
  } catch {
    return { seen: {} };
  }
}

function writeState(state: OnboardingState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isOnboardingSkipped(): boolean {
  return !!readState().seen.skipAll;
}

export function isHintSeen(key: OnboardingHintKey): boolean {
  if (isOnboardingSkipped()) return true;
  return !!readState().seen[key];
}

export function markHintSeen(key: OnboardingHintKey): void {
  const state = readState();
  state.seen[key] = true;
  writeState(state);
}

export function skipAllOnboarding(): void {
  markHintSeen('skipAll');
}
