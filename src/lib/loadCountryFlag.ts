const FLAG_CDN = 'https://flagcdn.com/w640';

const FLAG_CODE_ALIAS: Readonly<Record<string, string>> = {
  UK: 'gb',
};

const images = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement | null>>();

export function flagCdnCode(iso: string): string {
  const cc = iso.trim().toUpperCase();
  return FLAG_CODE_ALIAS[cc] ?? cc.toLowerCase();
}

export function getCachedFlagImage(iso: string): HTMLImageElement | null {
  return images.get(flagCdnCode(iso)) ?? null;
}

/** PNG с flagcdn (CORS). Повторные вызовы дедуплицируются. */
export function loadCountryFlag(
  iso: string,
  onReady?: () => void,
): HTMLImageElement | null {
  const code = flagCdnCode(iso);
  const cached = images.get(code);
  if (cached) return cached;
  const pending = inflight.get(code);
  if (pending) {
    if (onReady) void pending.then((img) => { if (img) onReady(); });
    return null;
  }

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      images.set(code, img);
      inflight.delete(code);
      onReady?.();
      resolve(img);
    };
    img.onerror = () => {
      inflight.delete(code);
      resolve(null);
    };
    img.src = `${FLAG_CDN}/${code}.png`;
  });
  inflight.set(code, promise);
  return null;
}

export function loadCountryFlagAsync(iso: string): Promise<HTMLImageElement | null> {
  const cached = getCachedFlagImage(iso);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(flagCdnCode(iso));
  if (pending) return pending;
  loadCountryFlag(iso);
  return inflight.get(flagCdnCode(iso)) ?? Promise.resolve(null);
}
