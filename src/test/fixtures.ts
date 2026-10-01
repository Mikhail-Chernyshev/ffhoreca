import type { Catalog, City, Place } from '../data/types';

export function city(overrides: Partial<City> & Pick<City, 'id' | 'name'>): City {
  return {
    countryCode: 'GE',
    lat: 41.7151,
    lng: 44.8271,
    ...overrides,
  };
}

export function place(
  overrides: Partial<Place> & Pick<Place, 'id' | 'name' | 'cityId'>,
): Place {
  return {
    countryCode: 'GE',
    categories: ['food'],
    address: '',
    summary: '',
    googleRating: null,
    photos: null,
    story: '',
    lat: 41.7151,
    lng: 44.8271,
    ...overrides,
  };
}

export function catalog(partial: Partial<Catalog> = {}): Catalog {
  return { cities: [], places: [], ...partial };
}
