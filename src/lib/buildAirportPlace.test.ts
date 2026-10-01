import {
  airportPlaceIdFromSuggestion,
  buildAirportPlaceAndCity,
  findExistingAirportPlace,
} from './buildAirportPlace';
import type { AirportSuggestion } from './airportSearch';
import { catalog, city, place } from '../test/fixtures';

const tbs: AirportSuggestion = {
  placeName: 'Tbilisi International Airport',
  label: 'Tbilisi, Georgia',
  lat: 41.6692,
  lng: 44.9547,
  localityHints: ['Tbilisi'],
  countryCodeOsm: 'GE',
  cityName: 'Tbilisi',
  googlePlaceId: 'ChIJtbs',
};

const copy = { summary: 'Airport', story: 'Airport' };

describe('airportPlaceIdFromSuggestion', () => {
  it('предпочитает Google Place ID', () => {
    expect(airportPlaceIdFromSuggestion(tbs)).toBe('gplace-ChIJtbs');
  });

  it('без Google ID собирает id из округлённых координат', () => {
    const osm = { ...tbs, googlePlaceId: undefined };
    expect(airportPlaceIdFromSuggestion(osm)).toBe('airport-41.6692-44.9547');
  });
});

describe('findExistingAirportPlace', () => {
  it('находит по id', () => {
    const existing = place({
      id: 'gplace-ChIJtbs',
      name: 'TBS',
      cityId: 'ge-tbilisi',
      categories: ['airport'],
    });
    expect(findExistingAirportPlace(catalog({ places: [existing] }), tbs)).toBe(existing);
  });

  it('находит по имени рядом (2.5 км)', () => {
    const existing = place({
      id: 'other',
      name: 'Tbilisi International Airport',
      cityId: 'ge-tbilisi',
      categories: ['airport'],
      lat: tbs.lat + 0.005,
      lng: tbs.lng,
    });
    expect(findExistingAirportPlace(catalog({ places: [existing] }), tbs)?.id).toBe('other');
  });
});

describe('buildAirportPlaceAndCity', () => {
  it('ошибка без кода страны', () => {
    expect(
      buildAirportPlaceAndCity(catalog(), { ...tbs, countryCodeOsm: undefined }, copy),
    ).toEqual({ error: 'missingCountry' });
  });

  it('привязывает к городу каталога', () => {
    const tbilisi = city({ id: 'ge-tbilisi', name: 'Tbilisi' });
    const built = buildAirportPlaceAndCity(catalog({ cities: [tbilisi] }), tbs, copy);
    expect(built).toMatchObject({
      cityExisted: true,
      city: { id: 'ge-tbilisi' },
      place: { categories: ['airport'], cityId: 'ge-tbilisi', id: 'gplace-ChIJtbs' },
    });
  });

  it('ошибка, если нельзя выбрать город', () => {
    expect(
      buildAirportPlaceAndCity(
        catalog(),
        {
          ...tbs,
          cityName: 'Khwaeng X',
          localityHints: ['Khwaeng X'],
          googlePlaceId: undefined,
        },
        copy,
      ),
    ).toEqual({ error: 'missingCity' });
  });
});
