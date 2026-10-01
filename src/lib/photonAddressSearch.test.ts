import {
  isFineGrainedLocality,
  preferredSettlementName,
  type AddressSuggestion,
} from './photonAddressSearch';

const base: AddressSuggestion = {
  placeName: 'X',
  label: 'X',
  lat: 0,
  lng: 0,
  localityHints: [],
};

describe('isFineGrainedLocality', () => {
  it('пустая строка и khwaeng — подрайон', () => {
    expect(isFineGrainedLocality('')).toBe(true);
    expect(isFineGrainedLocality('  ')).toBe(true);
    expect(isFineGrainedLocality('Khwaeng Wat Arun')).toBe(true);
    expect(isFineGrainedLocality('District khwaeng center')).toBe(true);
  });

  it('обычный город — не подрайон', () => {
    expect(isFineGrainedLocality('Bangkok')).toBe(false);
    expect(isFineGrainedLocality('Tbilisi')).toBe(false);
  });
});

describe('preferredSettlementName', () => {
  it('берёт cityName, если это не подрайон', () => {
    expect(
      preferredSettlementName({ ...base, cityName: 'Bangkok', localityHints: ['Khwaeng X'] }),
    ).toBe('Bangkok');
  });

  it('иначе первый hint, который не khwaeng', () => {
    expect(
      preferredSettlementName({
        ...base,
        localityHints: ['Khwaeng Foo', 'Bangkok'],
      }),
    ).toBe('Bangkok');
  });
});
