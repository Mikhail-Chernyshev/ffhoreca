/** Витрина: AZ и QA по умолчанию (пересадки), пока сервер не ответил. */
export const SHOWCASE_DEFAULT_TRANSIT = ['AZ', 'QA'] as const;

export function parseTransitCodes(raw: unknown): string[] {
  const src = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw) as unknown;
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of src) {
    if (typeof item !== 'string') continue;
    const code = item.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function transitSet(codes: readonly string[]): Set<string> {
  return new Set(parseTransitCodes(codes));
}

export function toggleTransitCode(codes: readonly string[], code: string): string[] {
  const next = new Set(parseTransitCodes(codes));
  const cc = code.trim().toUpperCase();
  if (next.has(cc)) next.delete(cc);
  else next.add(cc);
  return [...next].sort();
}
