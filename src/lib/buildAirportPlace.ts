import type { Catalog, City, Place } from '../data/types';
import { resolvePlaceCityId } from '../data/selectors';
import { makeCityId } from './makeCityId';
import {
  isFineGrainedLocality,
  preferredSettlementName,
} from './photonAddressSearch';
import type { AirportSuggestion } from './airportSearch';

const NEAR_M = 2500;

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export function airportPlaceIdFromSuggestion(s: AirportSuggestion): string {
  if (s.googlePlaceId) return `gplace-${s.googlePlaceId}`;
  const lat = Math.round(s.lat * 1e4) / 1e4;
  const lng = Math.round(s.lng * 1e4) / 1e4;
  return `airport-${lat}-${lng}`;
}

/** Уже есть такой аэропорт в каталоге? */
export function findExistingAirportPlace(
  catalog: Catalog,
  s: AirportSuggestion,
): Place | undefined {
  const wantedId = airportPlaceIdFromSuggestion(s);
  const byId = catalog.places.find(
    (p) => p.id === wantedId && p.categories.includes('airport'),
  );
  if (byId) return byId;

  const nameN = normName(s.placeName);
  for (const p of catalog.places) {
    if (!p.categories.includes('airport')) continue;
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
    if (haversineM({ lat: p.lat, lng: p.lng }, s) > NEAR_M) continue;
    if (normName(p.name) === nameN || normName(p.name).includes(nameN) || nameN.includes(normName(p.name))) {
      return p;
    }
  }
  return undefined;
}

export type BuiltAirport = {
  place: Place;
  city: City;
  /** Город уже был в каталоге */
  cityExisted: boolean;
};

/**
 * Собирает City + Place(airport) для автодобавления при выборе в авиапикере.
 * summary/story — короткие плейсхолдеры (сервер требует непустые строки).
 */
export function buildAirportPlaceAndCity(
  catalog: Catalog,
  s: AirportSuggestion,
  copy: { summary: string; story: string },
): BuiltAirport | { error: string } {
  const cc = s.countryCodeOsm?.toUpperCase();
  if (!cc || cc.length !== 2) {
    return { error: 'missingCountry' };
  }

  let cityId = resolvePlaceCityId(catalog, [], {
    lat: s.lat,
    lng: s.lng,
    localityHints: s.localityHints,
    countryCodeOsm: s.countryCodeOsm,
    cityName: s.cityName,
  });

  let city = cityId ? catalog.cities.find((c) => c.id === cityId) : undefined;
  let cityExisted = Boolean(city);

  if (!city) {
    const createName = preferredSettlementName(s);
    if (!createName || isFineGrainedLocality(createName)) {
      return { error: 'missingCity' };
    }
    cityId = makeCityId(cc, createName);
    const existingById = catalog.cities.find((c) => c.id === cityId);
    if (existingById) {
      city = existingById;
      cityExisted = true;
    } else {
      city = {
        id: cityId,
        name: createName,
        countryCode: cc,
        lat: Math.round(s.lat * 1e4) / 1e4,
        lng: Math.round(s.lng * 1e4) / 1e4,
      };
      cityExisted = false;
    }
  }

  if (!city || !cityId) return { error: 'missingCity' };

  const place: Place = {
    id: airportPlaceIdFromSuggestion(s),
    name: s.placeName.trim(),
    countryCode: city.countryCode,
    cityId: city.id,
    categories: ['airport'],
    address: (s.label || s.placeName).trim(),
    summary: copy.summary,
    story: copy.story,
    googleRating: typeof s.googleRating === 'number' ? s.googleRating : null,
    photos: null,
    lat: Math.round(s.lat * 1e6) / 1e6,
    lng: Math.round(s.lng * 1e6) / 1e6,
  };

  return { place, city, cityExisted };
}
