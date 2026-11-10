const STORAGE_KEY = 'ffhoreca_onboarding_v1';

export type OnboardingHintKey =
  | 'showcaseBanner'
  | 'firstCity'
  | 'firstPlace'
  | 'firstRoute'
  | 'firstSearch'
  | 'firstPlaceOpen'
  | 'checklistDismissed'
  | 'firstTripWizard'
  | 'firstPostcard'
  | 'firstTip'
  | 'skipAll';

/** Не прячем «Пропустить обучение» — это шаги удержания, не тур. */
const SKIP_ALL_EXEMPT: ReadonlySet<OnboardingHintKey> = new Set([
  'firstTripWizard',
  'firstPostcard',
  'firstTip',
]);

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
  if (!SKIP_ALL_EXEMPT.has(key) && isOnboardingSkipped()) return true;
  return !!readState().seen[key];
}

export function isFirstTripDismissed(): boolean {
  return !!readState().seen.firstTripWizard;
}

export function markHintSeen(key: OnboardingHintKey): void {
  const state = readState();
  state.seen[key] = true;
  writeState(state);
}

export function skipAllOnboarding(): void {
  markHintSeen('skipAll');
}
