import { unlockedStamps, worldCoveragePercent, WORLD_COUNTRY_COUNT } from './travelPassport';

describe('travelPassport', () => {
  it('counts coverage against 195 countries', () => {
    expect(WORLD_COUNTRY_COUNT).toBe(195);
    expect(worldCoveragePercent(0)).toBe(0);
    expect(worldCoveragePercent(20)).toBe(10);
    expect(worldCoveragePercent(195)).toBe(100);
    expect(worldCoveragePercent(400)).toBe(100);
  });

  it('unlocks stamps by country count', () => {
    expect(unlockedStamps(0)).toEqual([]);
    expect(unlockedStamps(1)).toEqual(['first']);
    expect(unlockedStamps(20)).toEqual(['first', 'five', 'ten', 'world10']);
  });
});
