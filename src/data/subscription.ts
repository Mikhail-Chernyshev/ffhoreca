export type UserSubscription = 'freemium' | 'premium';

export type MapVisibility = 'public' | 'subscribers';

/** Лимиты Freemium проверяются на сервере и показываются в UI. */
export const FREEMIUM_LIMITS_ENFORCED = true;

export const FREEMIUM_LIMITS = {
  countries: 10,
  cities: 20,
  routes: 20,
  places: 40,
} as const;

export const SUBSCRIPTION_PLANS: readonly UserSubscription[] = ['freemium', 'premium'];
