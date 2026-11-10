import { catalog, city } from '../test/fixtures';
import type { TravelRoute } from '../data/types';
import { suggestedTipCity } from '../data/selectors';
import {
  buildPostcardData,
  flagGridLayout,
  latestRouteLeg,
  postcardFilename,
} from './postcard';

const route = (
  waypoints: TravelRoute['waypoints'],
  id = 'r1',
): TravelRoute => ({
  id,
  mode: 'plane',
  waypoints,
});

describe('postcard', () => {
  it('берёт последний маршрут с двумя точками', () => {
    expect(latestRouteLeg([])).toBeNull();
    expect(
      latestRouteLeg([
        route([{ cityId: 'a', name: 'Solo', lat: 0, lng: 0 }]),
      ]),
    ).toBeNull();
    expect(
      latestRouteLeg([
        route(
          [
            { cityId: 'a', name: 'Tbilisi', lat: 1, lng: 1 },
            { cityId: 'b', name: 'Batumi', lat: 2, lng: 2 },
          ],
          'old',
        ),
        route(
          [
            { cityId: 'c', name: 'Rome', lat: 3, lng: 3 },
            { cityId: 'd', name: 'Paris', lat: 4, lng: 4 },
          ],
          'new',
        ),
      ]),
    ).toEqual({ from: 'Rome', to: 'Paris' });
  });

  it('раскладывает флаги без обрезки, если места хватает', () => {
    const grid = flagGridLayout(8, 900, 400);
    expect(grid.shown).toBe(8);
    expect(grid.extra).toBe(0);
    expect(grid.cols).toBeGreaterThan(1);
    expect(grid.flagH).toBeGreaterThanOrEqual(32);
  });

  it('прячет лишние флаги за +N', () => {
    const grid = flagGridLayout(80, 900, 220);
    expect(grid.shown).toBeGreaterThan(0);
    expect(grid.shown + grid.extra).toBe(80);
    expect(grid.extra).toBeGreaterThan(0);
  });

  it('собирает данные открытки без транзита', () => {
    const data = buildPostcardData({
      name: 'Misha',
      username: 'misha',
      catalog: catalog({
        cities: [
          city({ id: 'ge-tbs', name: 'Tbilisi', countryCode: 'GE' }),
          city({ id: 'az-bak', name: 'Baku', countryCode: 'AZ' }),
        ],
      }),
      routes: [
        route([
          { cityId: 'ge-tbs', name: 'Tbilisi', lat: 41, lng: 44 },
          { cityId: 'az-bak', name: 'Baku', lat: 40, lng: 49 },
        ]),
      ],
      transit: new Set(['AZ']),
      locale: 'ru',
      mapUrl: 'https://example.com/misha',
    });
    expect(data.countryCodes).toEqual(['GE']);
    expect(data.countries).toBe(1);
    expect(data.percent).toBe(1);
    expect(data.routeFrom).toBe('Tbilisi');
    expect(data.routeTo).toBe('Baku');
    expect(postcardFilename(data.username)).toBe('tips-from-trips-misha.png');
  });

  it('предлагает город прибытия для первого совета', () => {
    const cities = [
      city({ id: 'ge-tbs', name: 'Tbilisi', countryCode: 'GE' }),
      city({ id: 'az-bak', name: 'Baku', countryCode: 'AZ' }),
    ];
    expect(
      suggestedTipCity(catalog({ cities }), [
        route([
          { cityId: 'ge-tbs', name: 'Tbilisi', lat: 41, lng: 44 },
          { cityId: 'az-bak', name: 'Baku', lat: 40, lng: 49 },
        ]),
      ])?.id,
    ).toBe('az-bak');
  });
});
