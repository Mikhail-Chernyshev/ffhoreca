import crypto from 'node:crypto';
import type { TravelRoute } from '../../src/data/types';

export type ShareOgInput = {
  name: string;
  username: string;
  countryCodes: string[];
  cities: number;
  routes: number;
  routeFrom: string | null;
  routeTo: string | null;
};

export function latestShareRouteLeg(
  routes: TravelRoute[],
): { from: string; to: string } | null {
  for (let i = routes.length - 1; i >= 0; i--) {
    const wp = routes[i]?.waypoints ?? [];
    if (wp.length < 2) continue;
    const from = wp[0]?.name?.trim();
    const to = wp[wp.length - 1]?.name?.trim();
    if (from && to) return { from, to };
  }
  return null;
}

export function shareOgEtag(input: ShareOgInput): string {
  return crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        n: input.name,
        u: input.username,
        c: input.countryCodes,
        ci: input.cities,
        r: input.routes,
        f: input.routeFrom,
        t: input.routeTo,
      }),
    )
    .digest('hex')
    .slice(0, 12);
}
