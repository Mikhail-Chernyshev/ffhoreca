import { FREEMIUM_LIMITS } from '../data/subscription';
import { limitReachedMessage, subscriptionPlanLabel } from './limitMessages';

const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}:${JSON.stringify(vars)}` : key;

describe('limitReachedMessage', () => {
  it('подставляет лимиты Freemium в ключ перевода', () => {
    expect(limitReachedMessage(t, 'countries')).toBe(
      `limits.reachedCountries:${JSON.stringify({ n: FREEMIUM_LIMITS.countries })}`,
    );
    expect(limitReachedMessage(t, 'places')).toBe(
      `limits.reachedPlaces:${JSON.stringify({ n: FREEMIUM_LIMITS.places })}`,
    );
  });
});

describe('subscriptionPlanLabel', () => {
  it('различает premium и freemium', () => {
    expect(subscriptionPlanLabel(t, 'premium')).toBe('account.planPremium');
    expect(subscriptionPlanLabel(t, 'freemium')).toBe('account.planFreemium');
  });
});
