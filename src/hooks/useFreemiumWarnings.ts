import { useEffect } from 'react';
import { FREEMIUM_LIMITS } from '../data/subscription';
import type { UserUsage } from '../lib/apiAuth';
import type { UserSubscription } from '../data/subscription';
import { useToast } from '../components/ToastProvider';
import { useT } from '../i18n/LocaleContext';

const APPROACH_RATIO = 0.8;

function sessionKey(kind: string): string {
  return `ffhoreca_limit_warn_${kind}`;
}

function maybeWarn(
  kind: 'countries' | 'routes' | 'places',
  used: number,
  max: number,
  message: string,
  push: (message: string, variant?: 'info' | 'warn' | 'error') => void,
): void {
  const threshold = Math.ceil(max * APPROACH_RATIO);
  if (used < threshold) return;
  const key = sessionKey(kind);
  if (sessionStorage.getItem(key) === String(used)) return;
  sessionStorage.setItem(key, String(used));
  push(message, used >= max ? 'error' : 'warn');
}

/** Показывает toast при приближении к лимитам Freemium (один раз за сессию на каждый тип). */
export function useFreemiumWarnings(
  subscription: UserSubscription | undefined,
  usage: UserUsage | null,
): void {
  const { push } = useToast();
  const t = useT();

  useEffect(() => {
    if (!usage || subscription !== 'freemium') return;

    maybeWarn(
      'countries',
      usage.countries,
      FREEMIUM_LIMITS.countries,
      t('limits.approachingCountries', {
        used: usage.countries,
        max: FREEMIUM_LIMITS.countries,
      }),
      push,
    );
    maybeWarn(
      'routes',
      usage.routes,
      FREEMIUM_LIMITS.routes,
      t('limits.approachingRoutes', {
        used: usage.routes,
        max: FREEMIUM_LIMITS.routes,
      }),
      push,
    );
    maybeWarn(
      'places',
      usage.places,
      FREEMIUM_LIMITS.places,
      t('limits.approachingPlaces', {
        used: usage.places,
        max: FREEMIUM_LIMITS.places,
      }),
      push,
    );
  }, [usage, subscription, push, t]);
}
