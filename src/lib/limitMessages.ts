import { FREEMIUM_LIMITS } from '../data/subscription';
import type { UserSubscription } from '../data/subscription';

export type LimitCode = 'countries' | 'cities' | 'routes' | 'places';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function limitReachedMessage(t: TFn, code: LimitCode): string {
  if (code === 'countries') {
    return t('limits.reachedCountries', { n: FREEMIUM_LIMITS.countries });
  }
  if (code === 'cities') {
    return t('limits.reachedCities', { n: FREEMIUM_LIMITS.cities });
  }
  if (code === 'routes') {
    return t('limits.reachedRoutes', { n: FREEMIUM_LIMITS.routes });
  }
  return t('limits.reachedPlaces', { n: FREEMIUM_LIMITS.places });
}

export function subscriptionPlanLabel(t: TFn, subscription: UserSubscription): string {
  return subscription === 'premium' ? t('account.planPremium') : t('account.planFreemium');
}
