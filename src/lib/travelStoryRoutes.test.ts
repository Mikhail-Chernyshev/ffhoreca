import {
  mergeCatalogWithStoryRouteCities,
  positionAndBearingOneWayOnArc,
  travelStoryRouteCityIds,
} from './travelStoryRoutes';
import { catalog, city } from '../test/fixtures';

describe('travelStoryRouteCityIds', () => {
  it('уникальные отсортированные id из сюжетных ног', () => {
    const ids = travelStoryRouteCityIds();
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('ru-saint-petersburg');
    expect(ids).toContain('ge-tbilisi');
  });
});

describe('mergeCatalogWithStoryRouteCities', () => {
  it('подмешивает города сюжета, которых нет в каталоге', () => {
    const merged = mergeCatalogWithStoryRouteCities(catalog());
    expect(merged.cities.some((c) => c.id === 'ru-saint-petersburg')).toBe(true);
  });

  it('не дублирует город, который уже есть', () => {
    const existing = city({
      id: 'ru-saint-petersburg',
      name: 'SPb',
      countryCode: 'RU',
    });
    const merged = mergeCatalogWithStoryRouteCities(catalog({ cities: [existing] }));
    expect(merged.cities.filter((c) => c.id === 'ru-saint-petersburg')).toHaveLength(1);
    expect(merged.cities.find((c) => c.id === 'ru-saint-petersburg')?.name).toBe('SPb');
  });
});

describe('positionAndBearingOneWayOnArc', () => {
  const line: [number, number][] = [
    [0, 0],
    [10, 0],
  ];

  it('для короткой линии возвращает null', () => {
    expect(positionAndBearingOneWayOnArc([[0, 0]], 0.5)).toBeNull();
  });

  it('в начале дуги стоит в первой точке, в конце — в последней', () => {
    const start = positionAndBearingOneWayOnArc(line, 0);
    const end = positionAndBearingOneWayOnArc(line, 1);
    expect(start).toMatchObject({ lng: 0, lat: 0 });
    expect(end).toMatchObject({ lng: 10, lat: 0 });
    expect(start?.bearing).toBeCloseTo(90, 0);
  });
});
