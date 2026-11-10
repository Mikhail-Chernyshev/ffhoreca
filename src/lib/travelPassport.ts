/** UN members + Holy See + Palestine — usual “% of the world” denominator. */
export const WORLD_COUNTRY_COUNT = 195;

export type StampId =
  | 'first'
  | 'five'
  | 'ten'
  | 'twentyFive'
  | 'fifty'
  | 'world10'
  | 'world25'
  | 'world50';

export const PASSPORT_STAMPS: { id: StampId; minCountries: number }[] = [
  { id: 'first', minCountries: 1 },
  { id: 'five', minCountries: 5 },
  { id: 'ten', minCountries: 10 },
  { id: 'twentyFive', minCountries: 25 },
  { id: 'fifty', minCountries: 50 },
  { id: 'world10', minCountries: 20 },
  { id: 'world25', minCountries: 49 },
  { id: 'world50', minCountries: 98 },
];

export function worldCoveragePercent(countries: number): number {
  if (countries <= 0) return 0;
  return Math.min(100, Math.round((countries / WORLD_COUNTRY_COUNT) * 100));
}

export function unlockedStamps(countries: number): StampId[] {
  return PASSPORT_STAMPS.filter((s) => countries >= s.minCountries).map((s) => s.id);
}
