import type { UserSubscription } from '../data/subscription';

export type LimitCode = 'countries' | 'routes' | 'places';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function limitReachedMessage(t: TFn, code: LimitCode): string {
  if (code === 'countries') return t('limits.reachedCountries');
  if (code === 'routes') return t('limits.reachedRoutes');
  return t('limits.reachedPlaces');
}

export function subscriptionPlanLabel(t: TFn, subscription: UserSubscription): string {
  return subscription === 'premium' ? t('account.planPremium') : t('account.planFreemium');
}
