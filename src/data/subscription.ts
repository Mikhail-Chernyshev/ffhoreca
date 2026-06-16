export type UserSubscription = 'freemium' | 'premium';

export type MapVisibility = 'public' | 'subscribers';

/** Пока Premium не запущен — лимиты Freemium не проверяются ни на сервере, ни в UI. */
export const FREEMIUM_LIMITS_ENFORCED = false;

export const FREEMIUM_LIMITS = {
  countries: 10,
  routes: 15,
  places: 50,
} as const;

export const SUBSCRIPTION_PLANS: readonly UserSubscription[] = ['freemium', 'premium'];
