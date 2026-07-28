import { useEffect } from 'react';
import { BrandLogo } from './BrandLogo';

/** Короткая тихая заставка: логотип + прогресс. */
export const SPLASH_ANIMATION_MS = 1_400;

type Props = {
  onAnimationComplete?: () => void;
};

export function LoadingLetterSplash({ onAnimationComplete }: Props) {
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ms = reduced ? 200 : SPLASH_ANIMATION_MS;
    const t = window.setTimeout(() => onAnimationComplete?.(), ms);
    return () => window.clearTimeout(t);
  }, [onAnimationComplete]);

  return (
    <div className="loading-splash" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-splash__panel">
        <BrandLogo variant="lockup" height={48} className="loading-splash__logo" />
        <div className="loading-splash__bar" aria-hidden>
          <span className="loading-splash__bar-fill" />
        </div>
      </div>
    </div>
  );
}
