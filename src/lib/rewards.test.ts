import { catalog, city, place } from '../test/fixtures';
import type { TravelRoute } from '../data/types';
import {
  ASIA_EXPERT_TARGET,
  collectRewardStats,
  continentOf,
  CONTINENT_COUNT,
  evaluateRewards,
  REMOTE_WORKER_COUNTRY_CODES,
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

  it('opens group tourism at 5 followers', () => {
    const locked = Object.fromEntries(
      evaluateRewards(collectRewardStats(catalog(), [], new Set(), { followers: 4 })).map(
        (r) => [r.id, r],
      ),
    );
    const open = Object.fromEntries(
      evaluateRewards(collectRewardStats(catalog(), [], new Set(), { followers: 5 })).map(
        (r) => [r.id, r],
      ),
    );
    expect(locked.groupTourism?.unlocked).toBe(false);
    expect(open.groupTourism?.unlocked).toBe(true);
    expect(open.groupTourism?.target).toBe(5);
  });

  it('unlocks Asia expert at 7 Asian countries', () => {
    const codes = ['GE', 'JP', 'TH', 'VN', 'ID', 'MY', 'KR'];
    const cities = codes.map((cc, i) =>
      city({ id: `${cc.toLowerCase()}-1`, name: `City ${i}`, countryCode: cc }),
    );
    const stats = collectRewardStats(catalog({ cities }), []);
    expect(stats.asia).toBe(ASIA_EXPERT_TARGET);
    const byId = Object.fromEntries(evaluateRewards(stats).map((r) => [r.id, r]));
    expect(byId.asiaExpert?.unlocked).toBe(true);
  });

  it('unlocks typical remote worker on the five SE Asia countries', () => {
    const cities = [...REMOTE_WORKER_COUNTRY_CODES].map((cc) =>
      city({ id: `${cc.toLowerCase()}-1`, name: cc, countryCode: cc }),
    );
    const stats = collectRewardStats(catalog({ cities }), []);
    expect(stats.nomadFive).toBe(5);
    const byId = Object.fromEntries(evaluateRewards(stats).map((r) => [r.id, r]));
    expect(byId.typicalRemote?.unlocked).toBe(true);
  });

  it('counts Michelin as unique food or bar places and Revizorro at 25 hotels', () => {
    const places = [
      place({ id: 'both', name: 'Both', cityId: 'c1', categories: ['food', 'bar'] }),
      ...Array.from({ length: 24 }, (_, i) =>
        place({ id: `h${i}`, name: `Hotel ${i}`, cityId: 'c1', categories: ['lodging'] }),
      ),
    ];
    const stats = collectRewardStats(catalog({ places }), []);
    expect(stats.foodOrBar).toBe(1);
    expect(stats.lodging).toBe(24);
    const byId = Object.fromEntries(evaluateRewards(stats).map((r) => [r.id, r]));
    expect(byId.michelin?.unlocked).toBe(false);
    expect(byId.revizorro?.unlocked).toBe(false);
    expect(byId.innkeeper?.unlocked).toBe(true);
  });

  it('opens city and route ladders at 50 / 100 / 200 and 25 / 50', () => {
    const cities = Array.from({ length: 50 }, (_, i) =>
      city({ id: `c-${i}`, name: `City ${i}`, countryCode: 'GE' }),
    );
    const routes = Array.from({ length: 25 }, (_, i) => route({ id: `rt-${i}`, mode: 'train' }));
    const stats = collectRewardStats(catalog({ cities }), routes);
    const byId = Object.fromEntries(evaluateRewards(stats).map((r) => [r.id, r]));
    expect(byId.cityFifty?.unlocked).toBe(true);
    expect(byId.cityHundred?.unlocked).toBe(false);
    expect(byId.cityTwoHundred?.unlocked).toBe(false);
    expect(byId.routeTrail?.unlocked).toBe(true);
    expect(byId.routeAtlas?.unlocked).toBe(false);
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
