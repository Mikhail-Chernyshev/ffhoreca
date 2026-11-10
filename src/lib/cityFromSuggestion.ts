import type { City } from '../data/types';
import type { CitySuggestion } from './citySearch';
import { makeCityId } from './makeCityId';

export function cityFromSuggestion(s: CitySuggestion): City | null {
  const name = s.name.trim();
  const countryCode = s.countryCode?.trim().toUpperCase() ?? '';
  if (!name || countryCode.length !== 2) return null;
  return {
    id: makeCityId(countryCode, name),
    name,
    countryCode,
    lng: Math.round(s.lng * 1e4) / 1e4,
    lat: Math.round(s.lat * 1e4) / 1e4,
  };
}
