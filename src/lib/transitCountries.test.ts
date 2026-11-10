import { catalog, city, place } from '../test/fixtures';
import { countedCountryCodes, visitedCountryCodes } from '../data/selectors';
import { parseTransitCodes, toggleTransitCode } from './transitCountries';

const sample = catalog({
  cities: [
    city({ id: 'az-baku', name: 'Baku', countryCode: 'AZ' }),
    city({ id: 'ge-tbs', name: 'Tbilisi', countryCode: 'GE' }),
  ],
  places: [place({ id: 'qa-doh', name: 'Doha', cityId: 'x', countryCode: 'QA' })],
});

describe('transitCountries', () => {
  it('нормализует коды', () => {
    expect(parseTransitCodes(['az', 'QA', 'az', 'xx1', 3])).toEqual(['AZ', 'QA']);
  });

  it('переключает транзит', () => {
    expect(toggleTransitCode(['AZ'], 'qa')).toEqual(['AZ', 'QA']);
    expect(toggleTransitCode(['AZ', 'QA'], 'AZ')).toEqual(['QA']);
  });

  it('не считает транзитные страны', () => {
    expect(visitedCountryCodes(sample)).toEqual(new Set(['AZ', 'GE', 'QA']));
    expect(countedCountryCodes(sample, new Set(['AZ', 'QA']))).toEqual(new Set(['GE']));
  });
});
