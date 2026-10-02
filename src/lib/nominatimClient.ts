/** Общая очередь к Nominatim: не чаще 1 запроса/с и пауза на 429. */

export const NOMINATIM_MIN_INTERVAL_MS = 1100;

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'ffhoreca-travel-map/1.0',
};

export class NominatimRateLimitError extends Error {
  override name = 'NominatimRateLimitError';
  constructor() {
    super('Nominatim rate limit (429)');
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = globalThis.setTimeout(resolve, ms);
    const onAbort = () => {
      globalThis.clearTimeout(t);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

let lastAt = 0;
let chain: Promise<void> = Promise.resolve();

function retryAfterMs(res: Response, fallback: number): number {
  const raw = res.headers.get('retry-after');
  if (!raw) return fallback;
  const sec = Number(raw);
  if (Number.isFinite(sec) && sec >= 0) return Math.min(sec * 1000, 60_000);
  return fallback;
}

export async function nominatimGet(
  url: string,
  signal?: AbortSignal,
): Promise<Response> {
  const run = async (): Promise<Response> => {
    const wait = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastAt));
    if (wait > 0) await sleep(wait, signal);
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }

    let backoff = 4000;
    for (let attempt = 0; attempt < 4; attempt++) {
      lastAt = Date.now();
      const res = await fetch(url, { signal, headers: NOMINATIM_HEADERS });
      if (res.status !== 429) return res;
      if (attempt === 3) throw new NominatimRateLimitError();
      await sleep(retryAfterMs(res, backoff), signal);
      backoff = Math.min(backoff * 2, 30_000);
    }
    throw new NominatimRateLimitError();
  };

  const next = chain.then(run, run);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
