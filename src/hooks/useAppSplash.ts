import { useEffect, useState } from 'react';

const SPLASH_MAX_MS = 9_500;

/**
 * Показывать заставку, пока не готовы данные и не доиграла анимация,
 * но не дольше ~10 с.
 */
export function useAppSplash(dataReady: boolean) {
  const [animationDone, setAnimationDone] = useState(false);
  const [maxTimeReached, setMaxTimeReached] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMaxTimeReached(true), SPLASH_MAX_MS);
    return () => clearTimeout(t);
  }, []);

  const visible = !(maxTimeReached || (dataReady && animationDone));

  return {
    visible,
    onAnimationComplete: () => setAnimationDone(true),
  };
}
