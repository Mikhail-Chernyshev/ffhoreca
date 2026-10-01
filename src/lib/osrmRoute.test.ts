import { usesRoadRouting } from './osrmRoute';

describe('usesRoadRouting', () => {
  it('машина, автобус и поезд идут по дорогам OSRM', () => {
    expect(usesRoadRouting('car')).toBe(true);
    expect(usesRoadRouting('bus')).toBe(true);
    expect(usesRoadRouting('train')).toBe(true);
  });

  it('самолёт и лодка не используют OSRM', () => {
    expect(usesRoadRouting('plane')).toBe(false);
    expect(usesRoadRouting('boat')).toBe(false);
  });
});
