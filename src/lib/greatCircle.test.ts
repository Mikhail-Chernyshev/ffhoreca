import { bearingDegrees, greatCircleArc, haversineKm } from './greatCircle';

describe('haversineKm', () => {
  it('даёт 0 для одной точки', () => {
    expect(haversineKm(41.7, 44.8, 41.7, 44.8)).toBe(0);
  });

  it('считает расстояние Париж — Лондон около 340 км', () => {
    expect(haversineKm(48.8566, 2.3522, 51.5074, -0.1278)).toBeCloseTo(344, 0);
  });
});

describe('bearingDegrees', () => {
  it('на север ≈ 0°, на восток ≈ 90°', () => {
    expect(bearingDegrees(0, 0, 0, 1)).toBeCloseTo(0, 5);
    expect(bearingDegrees(0, 0, 1, 0)).toBeCloseTo(90, 5);
  });
});

describe('greatCircleArc', () => {
  it('для совпадающих точек возвращает одну координату', () => {
    expect(greatCircleArc(44.8, 41.7, 44.8, 41.7)).toEqual([[44.8, 41.7]]);
  });

  it('строит сегменты и заканчивает в конечной точке', () => {
    const arc = greatCircleArc(44.8, 41.7, 2.35, 48.85, 8);
    expect(arc).toHaveLength(9);
    expect(arc[0]![0]).toBeCloseTo(44.8, 5);
    expect(arc[0]![1]).toBeCloseTo(41.7, 5);
    expect(arc[arc.length - 1]![0]).toBeCloseTo(2.35, 2);
    expect(arc[arc.length - 1]![1]).toBeCloseTo(48.85, 2);
  });
});
