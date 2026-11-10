import { cityFromSuggestion } from './cityFromSuggestion';

describe('cityFromSuggestion', () => {
  it('собирает город из подсказки', () => {
    expect(
      cityFromSuggestion({
        name: 'Tbilisi',
        label: 'Tbilisi, Georgia',
        lng: 44.8271,
        lat: 41.7151,
        countryCode: 'ge',
      }),
    ).toEqual({
      id: 'ge-tbilisi',
      name: 'Tbilisi',
      countryCode: 'GE',
      lng: 44.8271,
      lat: 41.7151,
    });
  });

  it('без кода страны не подходит', () => {
    expect(
      cityFromSuggestion({
        name: 'Tbilisi',
        label: 'Tbilisi',
        lng: 44.8,
        lat: 41.7,
      }),
    ).toBeNull();
  });
});
