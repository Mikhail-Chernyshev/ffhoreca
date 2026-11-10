import {
  isHintSeen,
  isOnboardingSkipped,
  markHintSeen,
  skipAllOnboarding,
} from './onboardingStore';

const mem: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(mem)) delete mem[key];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (k in mem ? mem[k] : null),
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const key of Object.keys(mem)) delete mem[key];
      },
    },
  });
});

describe('onboardingStore', () => {
  it('не прячет шаги удержания после «пропустить обучение»', () => {
    skipAllOnboarding();
    expect(isOnboardingSkipped()).toBe(true);
    expect(isHintSeen('firstCity')).toBe(true);
    expect(isHintSeen('firstTripWizard')).toBe(false);
    expect(isHintSeen('firstPostcard')).toBe(false);
    expect(isHintSeen('firstTip')).toBe(false);
  });

  it('запоминает открытку и совет отдельно', () => {
    markHintSeen('firstPostcard');
    markHintSeen('firstTip');
    expect(isHintSeen('firstPostcard')).toBe(true);
    expect(isHintSeen('firstTip')).toBe(true);
    expect(isHintSeen('firstTripWizard')).toBe(false);
  });
});
