export type UserSubscription = 'freemium' | 'premium';

export type MapVisibility = 'public' | 'subscribers';

export const FREEMIUM_LIMITS = {
  countries: 10,
  routes: 15,
  places: 50,
} as const;

export const SUBSCRIPTION_PLANS: readonly UserSubscription[] = ['freemium', 'premium'];
