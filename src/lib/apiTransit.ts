import { apiBaseUrl, apiFetch } from './apiBase';
import { authHeaders } from './apiAuth';
import { parseTransitCodes, SHOWCASE_DEFAULT_TRANSIT } from './transitCountries';

export async function fetchShowcaseTransit(): Promise<string[]> {
  const base = apiBaseUrl();
  if (!base) return [...SHOWCASE_DEFAULT_TRANSIT];
  const res = await apiFetch(`${base}/api/transit-countries`);
  if (res.status === 404) return [...SHOWCASE_DEFAULT_TRANSIT];
  if (!res.ok) throw new Error(`transit ${res.status}`);
  const data = (await res.json()) as { transit_countries?: unknown };
  return parseTransitCodes(data.transit_countries);
}

export async function patchShowcaseTransit(codes: readonly string[]): Promise<string[]> {
  const base = apiBaseUrl();
  if (!base) throw new Error('API не настроен');
  const res = await apiFetch(`${base}/api/transit-countries`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ transit_countries: parseTransitCodes(codes) }),
  });
  const data = (await res.json()) as { transit_countries?: unknown; error?: string };
  if (!res.ok) throw new Error(data.error ?? `transit ${res.status}`);
  return parseTransitCodes(data.transit_countries);
}
