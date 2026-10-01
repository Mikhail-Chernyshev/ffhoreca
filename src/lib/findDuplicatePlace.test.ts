import { findDuplicatePlace } from './findDuplicatePlace';
import type { Place } from '../data/types';

function place(overrides: Partial<Place> & Pick<Place, 'id' | 'name' | 'cityId'>): Place {
  return {
    countryCode: 'GE',
    categories: ['food'],
    address: '',
    summary: '',
    googleRating: null,
    photos: null,
    story: '',
    lat: 41.693,
    lng: 44.801,
    ...overrides,
  };
}

const existing = place({ id: 'p1', name: 'Lovard', cityId: 'ge-tbilisi' });

describe('findDuplicatePlace', () => {
  it('возвращает null, если список мест пустой', () => {
    expect(
      findDuplicatePlace([], { name: 'Lovard', cityId: 'ge-tbilisi', lat: 41.693, lng: 44.801 }),
    ).toBeNull();
  });

  it('возвращает null, если у черновика пустое имя', () => {
    expect(
      findDuplicatePlace([existing], { name: '   ', cityId: 'ge-tbilisi', lat: 41.693, lng: 44.801 }),
    ).toBeNull();
  });

  it('находит то же имя в том же городе', () => {
    expect(
      findDuplicatePlace([existing], {
        name: 'Lovard',
        cityId: 'ge-tbilisi',
        lat: 41.7,
        lng: 44.8,
      }),
    ).toBe(existing);
  });

  it('считает «Ёлки» и «елки» одним именем в том же городе', () => {
    const yelki = place({ id: 'p2', name: 'Ёлки', cityId: 'ge-tbilisi' });
    expect(
      findDuplicatePlace([yelki], { name: 'елки', cityId: 'ge-tbilisi', lat: 0, lng: 0 }),
    ).toBe(yelki);
  });

  it('не считает дубликатом то же имя в другом городе, если точки далеко', () => {
    expect(
      findDuplicatePlace([existing], {
        name: 'Lovard',
        cityId: 'ru-moscow',
        lat: 55.75,
        lng: 37.62,
      }),
    ).toBeNull();
  });

  it('находит то же имя ближе 50 м, даже в другом городе', () => {
    expect(
      findDuplicatePlace([existing], {
        name: 'Lovard',
        cityId: 'ge-batumi',
        lat: existing.lat! + 0.0003,
        lng: existing.lng,
      }),
    ).toBe(existing);
  });

  it('не считает дубликатом то же имя дальше 50 м в другом городе', () => {
    expect(
      findDuplicatePlace([existing], {
        name: 'Lovard',
        cityId: 'ge-batumi',
        lat: existing.lat! + 0.001,
        lng: existing.lng,
      }),
    ).toBeNull();
  });

  it('не считает дубликатом другое имя в тех же координатах', () => {
    expect(
      findDuplicatePlace([existing], {
        name: 'Another Bar',
        cityId: 'ge-tbilisi',
        lat: existing.lat,
        lng: existing.lng,
      }),
    ).toBeNull();
  });
});
