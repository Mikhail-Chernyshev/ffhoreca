import { catalog, city, place } from '../test/fixtures';
import type { TravelRoute } from '../data/types';
import {
  collectRewardStats,
  continentOf,
  CONTINENT_COUNT,
  evaluateRewards,
  SCHENGEN_COUNTRY_CODES,
} from './rewards';
import { WORLD_COUNTRY_COUNT } from './travelPassport';

function route(partial: Partial<TravelRoute> & Pick<TravelRoute, 'id'>): TravelRoute {
  return {
    mode: 'plane',
    waypoints: [],
    ...partial,
  };
}

describe('rewards', () => {
  it('continentOf maps common codes', () => {
    expect(continentOf('GE')).toBe('AS');
    expect(continentOf('IT')).toBe('EU');
    expect(continentOf('BR')).toBe('SA');
    expect(continentOf('xx')).toBeNull();
  });

  it('opens greatStart at 3 countries and localExpert at 10 cities in one', () => {
    const cities = [
      city({ id: 'ge-1', name: 'Tbilisi', countryCode: 'GE' }),
      city({ id: 'it-1', name: 'Rome', countryCode: 'IT' }),
      city({ id: 'jp-1', name: 'Tokyo', countryCode: 'JP' }),
      ...Array.from({ length: 9 }, (_, i) =>
        city({ id: `ge-${i + 2}`, name: `City ${i}`, countryCode: 'GE' }),
      ),
    ];
    const stats = collectRewardStats(catalog({ cities }), [], new Set());
    expect(stats.countries).toBe(3);
    expect(stats.maxCitiesInOneCountry).toBe(10);
    const byId = Object.fromEntries(evaluateRewards(stats).map((r) => [r.id, r]));
    expect(byId.greatStart?.unlocked).toBe(true);
    expect(byId.fiveBorders?.unlocked).toBe(false);
    expect(byId.localExpert?.unlocked).toBe(true);
    expect(byId.worldWanderer?.unlocked).toBe(false);
    expect(byId.twoContinents?.unlocked).toBe(true);
  });

  it('counts food tips and plane routes', () => {
    const places = [
      place({ id: 'p1', name: 'Cafe', cityId: 'c1', categories: ['food'] }),
      place({
        id: 'p2',
        name: 'Bar',
        cityId: 'c1',
        categories: ['bar'],
        photos: ['x.jpg'],
        story: 'A long enough story about this bar.',
      }),
    ];
    const routes = [
      route({ id: 'r1', mode: 'plane' }),
      route({ id: 'r2', mode: 'plane' }),
      route({ id: 'r3', mode: 'train' }),
    ];
    const stats = collectRewardStats(catalog({ places }), routes);
    expect(stats.food).toBe(1);
    expect(stats.bars).toBe(1);
    expect(stats.withPhotos).toBe(1);
    expect(stats.withStory).toBe(1);
    expect(stats.planeRoutes).toBe(2);
    const byId = Object.fromEntries(evaluateRewards(stats).map((r) => [r.id, r]));
    expect(byId.firstTip?.unlocked).toBe(true);
    expect(byId.foodie?.unlocked).toBe(false);
    expect(byId.firstRoute?.unlocked).toBe(true);
    expect(byId.frequentFlyer?.current).toBe(2);
  });

  it('ignores transit countries in country achievements', () => {
    const cities = [
      city({ id: 'ge-1', name: 'Tbilisi', countryCode: 'GE' }),
      city({ id: 'qa-1', name: 'Doha', countryCode: 'QA' }),
    ];
    const stats = collectRewardStats(catalog({ cities }), [], new Set(['QA']));
    expect(stats.countries).toBe(1);
  });

  it('counts Schengen countries and keeps the full set as the expert target', () => {
    const cities = [
      city({ id: 'de-1', name: 'Berlin', countryCode: 'DE' }),
      city({ id: 'fr-1', name: 'Paris', countryCode: 'FR' }),
      city({ id: 'ge-1', name: 'Tbilisi', countryCode: 'GE' }),
    ];
    const stats = collectRewardStats(catalog({ cities }), []);
    expect(stats.schengen).toBe(2);
    const byId = Object.fromEntries(evaluateRewards(stats).map((r) => [r.id, r]));
    expect(SCHENGEN_COUNTRY_CODES.size).toBe(29);
    expect(byId.schengenExpert?.target).toBe(SCHENGEN_COUNTRY_CODES.size);
    expect(byId.schengenExpert?.current).toBe(2);
    expect(byId.schengenExpert?.unlocked).toBe(false);
  });

  it('unlocks Pangaea at every mapped continent', () => {
    const cities = [
      city({ id: 'it-1', name: 'Rome', countryCode: 'IT' }),
      city({ id: 'ge-1', name: 'Tbilisi', countryCode: 'GE' }),
      city({ id: 'za-1', name: 'Cape Town', countryCode: 'ZA' }),
      city({ id: 'us-1', name: 'NYC', countryCode: 'US' }),
      city({ id: 'br-1', name: 'Rio', countryCode: 'BR' }),
      city({ id: 'au-1', name: 'Sydney', countryCode: 'AU' }),
    ];
    const stats = collectRewardStats(catalog({ cities }), []);
    expect(stats.continents).toBe(CONTINENT_COUNT);
    const byId = Object.fromEntries(evaluateRewards(stats).map((r) => [r.id, r]));
    expect(byId.pangaea?.unlocked).toBe(true);
    expect(byId.pangaea?.target).toBe(6);
  });

  it('opens group tourism above 5 followers', () => {
    const locked = Object.fromEntries(
      evaluateRewards(collectRewardStats(catalog(), [], new Set(), { followers: 5 })).map(
        (r) => [r.id, r],
      ),
    );
    const open = Object.fromEntries(
      evaluateRewards(collectRewardStats(catalog(), [], new Set(), { followers: 6 })).map(
        (r) => [r.id, r],
      ),
    );
    expect(locked.groupTourism?.unlocked).toBe(false);
    expect(open.groupTourism?.unlocked).toBe(true);
    expect(open.groupTourism?.target).toBe(6);
  });

  it('keeps sea king locked even with enough boat routes', () => {
    const routes = Array.from({ length: 5 }, (_, i) => route({ id: `b${i}`, mode: 'boat' }));
    const stats = collectRewardStats(catalog(), routes);
    const byId = Object.fromEntries(evaluateRewards(stats).map((r) => [r.id, r]));
    expect(stats.boatRoutes).toBe(5);
    expect(byId.seaKing?.comingSoon).toBe(true);
    expect(byId.seaKing?.unlocked).toBe(false);
    expect(byId.seaKing?.current).toBe(5);
  });

  it('reaches the whole world only at 195 countries', () => {
    const empty = collectRewardStats(catalog(), []);
    const byId = Object.fromEntries(evaluateRewards(empty).map((r) => [r.id, r]));
    expect(byId.wholeWorld?.target).toBe(WORLD_COUNTRY_COUNT);
    expect(byId.wholeWorld?.unlocked).toBe(false);
  });
});
