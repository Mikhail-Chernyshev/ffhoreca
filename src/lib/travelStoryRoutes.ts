import type { Catalog, City } from '../data/types';
import { cityById } from '../data/selectors';
import {
  bearingDegrees,
  greatCircleArc,
  haversineKm,
  type LngLatDeg,
} from './greatCircle';

/**
 * Несколько независимых «историй» на карте (все сегменты анимируются параллельно):
 * — большой тур: Петербург → … → Стамбул → Петербург;
 * — перелёт Лиссабон → Стамбул;
 * — прежняя цепочка: Петербург → Стамбул → Лион → Бордо → Лиссабон;
 * — параллельные сегменты: Турция / Египет / Кавказ / Грузия / Катар / Таиланд;
 * — Беларусь / Россия (в т.ч. Ярославская область и Югра).
 */
export const TRAVEL_STORY_LEGS = [
  {
    id: 'spb-baku',
    fromCityId: 'ru-saint-petersburg',
    toCityId: 'az-baku',
    mode: 'plane' as const,
  },
  {
    id: 'baku-paris',
    fromCityId: 'az-baku',
    toCityId: 'fr-paris',
    mode: 'plane' as const,
  },
  {
    id: 'paris-brussels',
    fromCityId: 'fr-paris',
    toCityId: 'be-brussels',
    mode: 'train_highspeed' as const,
  },
  {
    id: 'brussels-bruges',
    fromCityId: 'be-brussels',
    toCityId: 'be-bruges',
    mode: 'train_regional' as const,
  },
  {
    id: 'bruges-antwerp',
    fromCityId: 'be-bruges',
    toCityId: 'be-antwerp',
    mode: 'train_regional' as const,
  },
  {
    id: 'antwerp-charleroi',
    fromCityId: 'be-antwerp',
    toCityId: 'be-charleroi',
    mode: 'bus' as const,
  },
  {
    id: 'charleroi-treviso',
    fromCityId: 'be-charleroi',
    toCityId: 'it-treviso',
    mode: 'plane' as const,
  },
  {
    id: 'venice-florence',
    fromCityId: 'it-venice',
    toCityId: 'it-florence',
    mode: 'train_highspeed' as const,
  },
  {
    id: 'florence-milan',
    fromCityId: 'it-florence',
    toCityId: 'it-milan',
    mode: 'train_highspeed' as const,
  },
  {
    id: 'milan-istanbul',
    fromCityId: 'it-milan',
    toCityId: 'tr-istanbul',
    mode: 'plane' as const,
  },
  {
    id: 'istanbul-spb',
    fromCityId: 'tr-istanbul',
    toCityId: 'ru-saint-petersburg',
    mode: 'plane' as const,
  },
  /** Отдельная дуга Лиссабон → Стамбул */
  {
    id: 'lisbon-istanbul',
    fromCityId: 'pt-lisbon',
    toCityId: 'tr-istanbul',
    mode: 'plane' as const,
  },
  /** Старая цепочка (раньше была единственной): Питер → Стамбул → Лион → Бордо → Лиссабон */
  {
    id: 'arc-spb-istanbul',
    fromCityId: 'ru-saint-petersburg',
    toCityId: 'tr-istanbul',
    mode: 'plane' as const,
  },
  {
    id: 'arc-istanbul-lyon',
    fromCityId: 'tr-istanbul',
    toCityId: 'fr-lyon',
    mode: 'plane' as const,
  },
  {
    id: 'arc-lyon-bordeaux',
    fromCityId: 'fr-lyon',
    toCityId: 'fr-bordeaux',
    mode: 'bus' as const,
  },
  {
    id: 'arc-bordeaux-lisbon',
    fromCityId: 'fr-bordeaux',
    toCityId: 'pt-lisbon',
    mode: 'plane' as const,
  },
  {
    id: 'moscow-side',
    fromCityId: 'ru-moscow',
    toCityId: 'tr-side',
    mode: 'plane' as const,
  },
  {
    id: 'moscow-sharm',
    fromCityId: 'ru-moscow',
    toCityId: 'eg-sharm-el-sheikh',
    mode: 'plane' as const,
  },
  {
    id: 'spb-hurghada',
    fromCityId: 'ru-saint-petersburg',
    toCityId: 'eg-hurghada',
    mode: 'plane' as const,
  },
  {
    id: 'sharm-cairo',
    fromCityId: 'eg-sharm-el-sheikh',
    toCityId: 'eg-cairo',
    mode: 'bus' as const,
  },
  {
    id: 'spb-mineralnye',
    fromCityId: 'ru-saint-petersburg',
    toCityId: 'ru-mineralnye-vody',
    mode: 'plane' as const,
  },
  {
    id: 'mineralnye-vladikavkaz',
    fromCityId: 'ru-mineralnye-vody',
    toCityId: 'ru-vladikavkaz',
    mode: 'car' as const,
  },
  {
    id: 'vladikavkaz-stepantsminda',
    fromCityId: 'ru-vladikavkaz',
    toCityId: 'ge-stepantsminda',
    mode: 'bicycle' as const,
  },
  {
    id: 'tbilisi-batumi',
    fromCityId: 'ge-tbilisi',
    toCityId: 'ge-batumi',
    mode: 'train_regional' as const,
  },
  {
    id: 'tbilisi-stepantsminda',
    fromCityId: 'ge-tbilisi',
    toCityId: 'ge-stepantsminda',
    mode: 'car' as const,
  },
  {
    id: 'tbilisi-doha',
    fromCityId: 'ge-tbilisi',
    toCityId: 'qa-doha',
    mode: 'plane' as const,
  },
  {
    id: 'doha-bangkok',
    fromCityId: 'qa-doha',
    toCityId: 'th-bangkok',
    mode: 'plane' as const,
  },
  {
    id: 'minsk-batumi',
    fromCityId: 'by-minsk',
    toCityId: 'ge-batumi',
    mode: 'plane' as const,
  },
  {
    id: 'spb-minsk',
    fromCityId: 'ru-saint-petersburg',
    toCityId: 'by-minsk',
    mode: 'plane' as const,
  },
  {
    id: 'spb-moscow',
    fromCityId: 'ru-saint-petersburg',
    toCityId: 'ru-moscow',
    mode: 'train_highspeed' as const,
  },
  {
    id: 'spb-nizhny',
    fromCityId: 'ru-saint-petersburg',
    toCityId: 'ru-nizhny-novgorod',
    mode: 'plane' as const,
  },
  {
    id: 'yaroslavl-moscow',
    fromCityId: 'ru-yaroslavl',
    toCityId: 'ru-moscow',
    mode: 'train_regional' as const,
  },
  {
    id: 'yaroslavl-spb',
    fromCityId: 'ru-yaroslavl',
    toCityId: 'ru-saint-petersburg',
    mode: 'plane' as const,
  },
  {
    id: 'yaroslavl-samara',
    fromCityId: 'ru-yaroslavl',
    toCityId: 'ru-samara',
    mode: 'train_regional' as const,
  },
  {
    id: 'yaroslavl-rybinsk',
    fromCityId: 'ru-yaroslavl',
    toCityId: 'ru-rybinsk',
    mode: 'train_regional' as const,
  },
  {
    id: 'yaroslavl-tuapse',
    fromCityId: 'ru-yaroslavl',
    toCityId: 'ru-tuapse',
    mode: 'train_regional' as const,
  },
  {
    id: 'yaroslavl-adler',
    fromCityId: 'ru-yaroslavl',
    toCityId: 'ru-adler',
    mode: 'train_regional' as const,
  },
  {
    id: 'moscow-khanty-mansiysk',
    fromCityId: 'ru-moscow',
    toCityId: 'ru-khanty-mansiysk',
    mode: 'plane' as const,
  },
] as const;

export type TravelVehicleMode =
  | 'plane'
  | 'bus'
  | 'train_highspeed'
  | 'train_regional'
  | 'car'
  | 'bicycle';

export type TravelStoryLegConfig = (typeof TRAVEL_STORY_LEGS)[number];

/**
 * Точки для сюжетных маршрутов, если в каталоге (например с API) ещё нет города —
 * иначе исчезают линии Петербург → Баку, Париж → Брюссель и т.д.
 */
export const TRAVEL_STORY_CITY_COORDS: Readonly<
  Record<string, { lng: number; lat: number }>
> = {
  'ru-saint-petersburg': { lng: 30.31413, lat: 59.9375 },
  'az-baku': { lng: 49.8671, lat: 40.4093 },
  'fr-paris': { lng: 2.3522, lat: 48.8566 },
  'be-brussels': { lng: 4.3517, lat: 50.8503 },
  'be-bruges': { lng: 3.2247, lat: 51.2093 },
  'be-antwerp': { lng: 4.4025, lat: 51.2194 },
  'be-charleroi': { lng: 4.4517, lat: 50.4107 },
  'it-treviso': { lng: 12.1944, lat: 45.6553 },
  'it-venice': { lng: 12.3155, lat: 45.4408 },
  'it-florence': { lng: 11.2558, lat: 43.7696 },
  'it-milan': { lng: 9.19, lat: 45.4642 },
  'tr-istanbul': { lng: 28.9784, lat: 41.0082 },
  'pt-lisbon': { lng: -9.1393, lat: 38.7223 },
  'fr-lyon': { lng: 4.8357, lat: 45.764 },
  'fr-bordeaux': { lng: -0.5792, lat: 44.8378 },
  'ru-moscow': { lng: 37.6173, lat: 55.7558 },
  'tr-side': { lng: 31.3889, lat: 36.7764 },
  'eg-sharm-el-sheikh': { lng: 34.2954, lat: 27.8644 },
  'eg-hurghada': { lng: 33.8116, lat: 27.2579 },
  'eg-cairo': { lng: 31.2357, lat: 30.0444 },
  'ru-mineralnye-vody': { lng: 43.1361, lat: 44.2108 },
  'ru-vladikavkaz': { lng: 44.6678, lat: 43.025 },
  'ge-verkhny-lars': { lng: 44.633, lat: 43.384 },
  'ge-tbilisi': { lng: 44.8271, lat: 41.7151 },
  'ge-stepantsminda': { lng: 44.6453, lat: 42.6575 },
  'ge-batumi': { lng: 41.636, lat: 41.6509 },
  'by-minsk': { lng: 27.5615, lat: 53.9045 },
  'ru-nizhny-novgorod': { lng: 44.002, lat: 56.2965 },
  'ru-yaroslavl': { lng: 39.8845, lat: 57.6261 },
  'ru-samara': { lng: 50.1018, lat: 53.1959 },
  'ru-rybinsk': { lng: 38.8586, lat: 58.0486 },
  'ru-tuapse': { lng: 39.0736, lat: 44.0988 },
  'ru-adler': { lng: 39.9167, lat: 43.4283 },
  'ru-khanty-mansiysk': { lng: 69.0019, lat: 61.0042 },
  'qa-doha': { lng: 51.531, lat: 25.285 },
  'th-bangkok': { lng: 100.5018, lat: 13.7563 },
};

function resolveStoryCityLngLat(
  catalog: Catalog,
  cityId: string,
): { lng: number; lat: number } | null {
  const c = cityById(catalog, cityId);
  if (c != null) return { lng: c.lng, lat: c.lat };
  const fb = TRAVEL_STORY_CITY_COORDS[cityId];
  return fb ?? null;
}

/**
 * Условная скорость: самолёт — база; остальные — доля от неё (дольше по времени на том же расстоянии).
 */
const PLANE_VISUAL_SPEED_KMH = 600_000;
const SPEED_RATIO: Record<TravelVehicleMode, number> = {
  plane: 1,
  train_highspeed: 0.42,
  train_regional: 0.2,
  bus: 0.28,
  car: 0.33,
  bicycle: 0.09,
};
const MIN_CYCLE_MS = 6_000;
const MAX_CYCLE_MS = 420_000;

function polylineLengthKm(coordinates: LngLatDeg[]): number {
  let km = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    km += haversineKm(lat1, lng1, lat2, lng2);
  }
  return km;
}

function cycleDurationMsForLeg(oneWayKm: number, mode: TravelVehicleMode): number {
  const speed = PLANE_VISUAL_SPEED_KMH * SPEED_RATIO[mode];
  const raw = (oneWayKm / speed) * 3_600_000;
  return Math.min(MAX_CYCLE_MS, Math.max(MIN_CYCLE_MS, raw));
}

function interpolateAlongArc(
  coordinates: LngLatDeg[],
  t01: number,
): { lng: number; lat: number } {
  const n = coordinates.length;
  const pos = Math.min(1, Math.max(0, t01)) * (n - 1);
  const i = Math.min(Math.floor(pos), n - 2);
  const f = pos - i;
  const [lng1, lat1] = coordinates[i];
  const [lng2, lat2] = coordinates[i + 1];
  return {
    lng: lng1 + (lng2 - lng1) * f,
    lat: lat1 + (lat2 - lat1) * f,
  };
}

/** Одно направление по дуге 0→1, затем цикл повторяется с начала. */
export function positionAndBearingOneWayOnArc(
  coordinates: LngLatDeg[],
  progress01: number,
): { lng: number; lat: number; bearing: number } | null {
  if (coordinates.length < 2) return null;
  const t = Math.min(1, Math.max(0, progress01));
  const n = coordinates.length;
  const eps = 1 / ((n - 1) * 24);

  const pos = interpolateAlongArc(coordinates, t);

  let bearing: number;
  if (t >= 1 - eps) {
    const posPrev = interpolateAlongArc(coordinates, Math.max(0, t - eps));
    bearing = bearingDegrees(posPrev.lng, posPrev.lat, pos.lng, pos.lat);
  } else {
    const pos2 = interpolateAlongArc(coordinates, Math.min(1, t + eps));
    bearing = bearingDegrees(pos.lng, pos.lat, pos2.lng, pos2.lat);
  }

  return { lng: pos.lng, lat: pos.lat, bearing };
}

export type TravelStoryRoute = {
  legId: string;
  fromCityId: string;
  toCityId: string;
  mode: TravelVehicleMode;
  coordinates: LngLatDeg[];
  cycleDurationMs: number;
};

export function buildTravelStoryRoutes(catalog: Catalog): TravelStoryRoute[] {
  const routes: TravelStoryRoute[] = [];

  for (const leg of TRAVEL_STORY_LEGS) {
    const from = resolveStoryCityLngLat(catalog, leg.fromCityId);
    const to = resolveStoryCityLngLat(catalog, leg.toCityId);
    if (from == null || to == null) continue;

    const coordinates = greatCircleArc(
      from.lng,
      from.lat,
      to.lng,
      to.lat,
      56,
    );
    const oneWayKm = polylineLengthKm(coordinates);
    const cycleDurationMs = cycleDurationMsForLeg(oneWayKm, leg.mode);

    routes.push({
      legId: leg.id,
      fromCityId: leg.fromCityId,
      toCityId: leg.toCityId,
      mode: leg.mode,
      coordinates,
      cycleDurationMs,
    });
  }

  return routes;
}

/** Уникальные id городов по всем сегментам сюжетных дуг. */
export function travelStoryRouteCityIds(): string[] {
  const s = new Set<string>();
  for (const leg of TRAVEL_STORY_LEGS) {
    s.add(leg.fromCityId);
    s.add(leg.toCityId);
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

function inferCountryCodeFromCityId(id: string): string {
  const i = id.indexOf('-');
  if (i <= 0) return 'ZZ';
  const prefix = id.slice(0, i);
  const map: Record<string, string> = {
    ru: 'RU',
    ge: 'GE',
    fr: 'FR',
    be: 'BE',
    it: 'IT',
    tr: 'TR',
    pt: 'PT',
    az: 'AZ',
    eg: 'EG',
    qa: 'QA',
    th: 'TH',
    by: 'BY',
    ae: 'AE',
    id: 'ID',
    kh: 'KH',
    my: 'MY',
    vn: 'VN',
    sg: 'SG',
    la: 'LA',
    mm: 'MM',
  };
  return map[prefix] ?? prefix.toUpperCase().slice(0, 2);
}

/**
 * Города из сюжетных маршрутов показываются на карте даже если их нет в текущем каталоге
 * (например в ответе API): подмешиваются записи из встроенного `catalog.ts` или координаты
 * из {@link TRAVEL_STORY_CITY_COORDS}.
 */
export function mergeCatalogWithStoryRouteCities(base: Catalog): Catalog {
  const existing = new Set(base.cities.map((c) => c.id));
  const extra: City[] = [];
  for (const id of travelStoryRouteCityIds()) {
    if (existing.has(id)) continue;
    const fb = TRAVEL_STORY_CITY_COORDS[id];
    if (fb == null) continue;
    extra.push({
      id,
      name: id,
      countryCode: inferCountryCodeFromCityId(id),
      lng: fb.lng,
      lat: fb.lat,
    });
  }
  if (extra.length === 0) return base;
  return { ...base, cities: [...base.cities, ...extra] };
}
