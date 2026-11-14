import { countedCountryCodes } from '../data/selectors';
import type { Catalog, Place, TravelRoute } from '../data/types';
import { WORLD_COUNTRY_COUNT } from './travelPassport';

export type RewardId =
  | 'firstBorder'
  | 'greatStart'
  | 'fiveBorders'
  | 'worldWanderer'
  | 'globetrotter'
  | 'fiftyNations'
  | 'longHaul'
  | 'centuryClub'
  | 'atlasAlmost'
  | 'wholeWorld'
  | 'schengenExpert'
  | 'twoContinents'
  | 'pangaea'
  | 'localExpert'
  | 'cityHopper'
  | 'firstTip'
  | 'foodie'
  | 'nightOwl'
  | 'innkeeper'
  | 'photographer'
  | 'storyteller'
  | 'firstRoute'
  | 'frequentFlyer'
  | 'groupTourism'
  | 'seaKing';

export type RewardGroup =
  | 'countries'
  | 'regions'
  | 'cities'
  | 'places'
  | 'routes'
  | 'people'
  | 'soon';

export type RewardStats = {
  countries: number;
  schengen: number;
  cities: number;
  maxCitiesInOneCountry: number;
  places: number;
  food: number;
  bars: number;
  lodging: number;
  withPhotos: number;
  withStory: number;
  routes: number;
  planeRoutes: number;
  boatRoutes: number;
  continents: number;
  followers: number;
};

export type RewardExtras = {
  followers?: number;
};

export type RewardDef = {
  id: RewardId;
  group: RewardGroup;
  target: number;
  value: (stats: RewardStats) => number;
  comingSoon?: boolean;
};

export type RewardProgress = {
  id: RewardId;
  group: RewardGroup;
  current: number;
  target: number;
  unlocked: boolean;
  comingSoon: boolean;
};

/** Official Schengen members as of 2025, including BG and RO. */
export const SCHENGEN_COUNTRY_CODES: ReadonlySet<string> = splitCodes(`
  AT BE BG CH CZ DE DK EE ES FI FR GR HR HU IS IT LI LT LU LV MT NL NO PL PT
  RO SE SI SK
`);

export const CONTINENT_COUNT = 6;
export const REWARD_GROUP_ORDER: readonly RewardGroup[] = [
  'countries',
  'regions',
  'cities',
  'places',
  'routes',
  'people',
  'soon',
];

const EUROPE = splitCodes(`
  AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GI GR HR HU IE IS IT LI LT
  LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM UA VA XK
`);
const ASIA = splitCodes(`
  AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB
  LK MM MN MO MV MY NP OM PH PK QA SA SG SY TH TJ TM TR TW UZ VN YE
`);
const AFRICA = splitCodes(`
  AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW KE KM LR LS
  LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA
  ZM ZW
`);
const NORTH_AMERICA = splitCodes(`
  AG BB BM BS BZ CA CR CU DM DO GD GT HN HT JM KN LC MX NI PA SV TT US VC
`);
const SOUTH_AMERICA = splitCodes(`
  AR BO BR CL CO EC GY PE PY SR UY VE
`);
const OCEANIA = splitCodes(`
  AU FJ FM KI MH NR NZ PG PW SB TO TV VU WS
`);

function splitCodes(raw: string): Set<string> {
  return new Set(raw.trim().split(/\s+/));
}

export function continentOf(countryCode: string): string | null {
  const cc = countryCode.trim().toUpperCase();
  if (!cc) return null;
  if (cc === 'RU') return 'EU';
  if (EUROPE.has(cc)) return 'EU';
  if (ASIA.has(cc)) return 'AS';
  if (AFRICA.has(cc)) return 'AF';
  if (NORTH_AMERICA.has(cc)) return 'NA';
  if (SOUTH_AMERICA.has(cc)) return 'SA';
  if (OCEANIA.has(cc)) return 'OC';
  return null;
}

function countByCategory(places: Place[], category: Place['categories'][number]): number {
  return places.filter((p) => p.categories.includes(category)).length;
}

export function collectRewardStats(
  catalog: Catalog,
  routes: TravelRoute[],
  transit: ReadonlySet<string> = new Set(),
  extras: RewardExtras = {},
): RewardStats {
  const countries = countedCountryCodes(catalog, transit);
  const citiesPerCountry = new Map<string, number>();
  for (const city of catalog.cities) {
    const cc = city.countryCode.trim().toUpperCase();
    if (!cc) continue;
    citiesPerCountry.set(cc, (citiesPerCountry.get(cc) ?? 0) + 1);
  }
  let maxCitiesInOneCountry = 0;
  for (const n of citiesPerCountry.values()) {
    if (n > maxCitiesInOneCountry) maxCitiesInOneCountry = n;
  }

  const continents = new Set<string>();
  let schengen = 0;
  for (const code of countries) {
    const continent = continentOf(code);
    if (continent) continents.add(continent);
    if (SCHENGEN_COUNTRY_CODES.has(code)) schengen += 1;
  }

  return {
    countries: countries.size,
    schengen,
    cities: catalog.cities.length,
    maxCitiesInOneCountry,
    places: catalog.places.length,
    food: countByCategory(catalog.places, 'food'),
    bars: countByCategory(catalog.places, 'bar'),
    lodging: countByCategory(catalog.places, 'lodging'),
    withPhotos: catalog.places.filter((p) => (p.photos?.length ?? 0) > 0).length,
    withStory: catalog.places.filter((p) => p.story.trim().length >= 20).length,
    routes: routes.length,
    planeRoutes: routes.filter((r) => r.mode === 'plane').length,
    boatRoutes: routes.filter((r) => r.mode === 'boat').length,
    continents: continents.size,
    followers: Math.max(0, extras.followers ?? 0),
  };
}

export const REWARD_DEFS: readonly RewardDef[] = [
  { id: 'firstBorder', group: 'countries', target: 1, value: (s) => s.countries },
  { id: 'greatStart', group: 'countries', target: 3, value: (s) => s.countries },
  { id: 'fiveBorders', group: 'countries', target: 5, value: (s) => s.countries },
  { id: 'worldWanderer', group: 'countries', target: 10, value: (s) => s.countries },
  { id: 'globetrotter', group: 'countries', target: 25, value: (s) => s.countries },
  { id: 'fiftyNations', group: 'countries', target: 50, value: (s) => s.countries },
  { id: 'longHaul', group: 'countries', target: 75, value: (s) => s.countries },
  { id: 'centuryClub', group: 'countries', target: 100, value: (s) => s.countries },
  { id: 'atlasAlmost', group: 'countries', target: 150, value: (s) => s.countries },
  {
    id: 'wholeWorld',
    group: 'countries',
    target: WORLD_COUNTRY_COUNT,
    value: (s) => s.countries,
  },
  {
    id: 'schengenExpert',
    group: 'regions',
    target: SCHENGEN_COUNTRY_CODES.size,
    value: (s) => s.schengen,
  },
  { id: 'twoContinents', group: 'regions', target: 2, value: (s) => s.continents },
  { id: 'pangaea', group: 'regions', target: CONTINENT_COUNT, value: (s) => s.continents },
  { id: 'localExpert', group: 'cities', target: 10, value: (s) => s.maxCitiesInOneCountry },
  { id: 'cityHopper', group: 'cities', target: 15, value: (s) => s.cities },
  { id: 'firstTip', group: 'places', target: 1, value: (s) => s.places },
  { id: 'foodie', group: 'places', target: 8, value: (s) => s.food },
  { id: 'nightOwl', group: 'places', target: 5, value: (s) => s.bars },
  { id: 'innkeeper', group: 'places', target: 5, value: (s) => s.lodging },
  { id: 'photographer', group: 'places', target: 5, value: (s) => s.withPhotos },
  { id: 'storyteller', group: 'places', target: 5, value: (s) => s.withStory },
  { id: 'firstRoute', group: 'routes', target: 1, value: (s) => s.routes },
  { id: 'frequentFlyer', group: 'routes', target: 3, value: (s) => s.planeRoutes },
  { id: 'groupTourism', group: 'people', target: 6, value: (s) => s.followers },
  {
    id: 'seaKing',
    group: 'soon',
    target: 5,
    value: (s) => s.boatRoutes,
    comingSoon: true,
  },
];

export function evaluateRewards(stats: RewardStats): RewardProgress[] {
  return REWARD_DEFS.map((def) => {
    const current = Math.max(0, def.value(stats));
    const comingSoon = Boolean(def.comingSoon);
    return {
      id: def.id,
      group: def.group,
      current,
      target: def.target,
      comingSoon,
      unlocked: !comingSoon && current >= def.target,
    };
  });
}
