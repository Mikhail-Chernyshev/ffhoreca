import { countryMatchesQuery, countryName } from './countryName';

describe('countryName', () => {
  it('возвращает локализованное имя', () => {
    expect(countryName('TH', 'en')).toBe('Thailand');
    expect(countryName('th', 'ru')).toBe('Таиланд');
  });

  it('неизвестный код оставляет как есть', () => {
    expect(countryName('ZZ', 'en')).toBe('ZZ');
  });
});

describe('countryMatchesQuery', () => {
  it('находит по коду и названию на обоих языках', () => {
    expect(countryMatchesQuery('TH', 'таиланд')).toBe(true);
    expect(countryMatchesQuery('TH', 'Thai')).toBe(true);
    expect(countryMatchesQuery('TH', 'th')).toBe(true);
    expect(countryMatchesQuery('TH', 'Georgia')).toBe(false);
  });
});
