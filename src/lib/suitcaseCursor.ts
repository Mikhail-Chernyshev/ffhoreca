import suitcaseUrl from '../assets/cursor-suitcase.png';
import suitcasePressUrl from '../assets/cursor-suitcase-press.png';

const IDLE = `url(${JSON.stringify(suitcaseUrl)}) 16 2, auto`;
const PRESS = `url(${JSON.stringify(suitcasePressUrl)}) 16 2, auto`;

/** Swap to the retracted-handle cursor while the suitcase is pressed. */
export function installSuitcaseCursorPress(): () => void {
  const root = document.documentElement;
  let timer = 0;

  root.style.setProperty('--cursor-suitcase', IDLE);
  const preload = new Image();
  preload.src = suitcasePressUrl;

  const isSuitcaseCursor = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    const cursor = getComputedStyle(target).cursor;
    return cursor.includes('cursor-suitcase') || cursor.includes('url(');
  };

  const apply = (value: string) => {
    root.style.setProperty('--cursor-suitcase', value);
  };

  const press = (e: PointerEvent) => {
    if (e.button !== 0 || !isSuitcaseCursor(e.target)) return;
    window.clearTimeout(timer);
    root.dataset.suitcasePress = '';
    apply(PRESS);
  };

  const release = () => {
    if (!('suitcasePress' in root.dataset)) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      delete root.dataset.suitcasePress;
      apply(IDLE);
    }, 140);
  };

  window.addEventListener('pointerdown', press, true);
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  window.addEventListener('blur', release);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('pointerdown', press, true);
    window.removeEventListener('pointerup', release, true);
    window.removeEventListener('pointercancel', release, true);
    window.removeEventListener('blur', release);
    delete root.dataset.suitcasePress;
    root.style.removeProperty('--cursor-suitcase');
  };
}
