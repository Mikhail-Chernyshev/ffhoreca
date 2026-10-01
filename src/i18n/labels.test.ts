import { categoryLabel, routeModeAria, routeModeLabel } from './labels';

describe('i18n labels', () => {
  it('отдаёт подписи категорий', () => {
    expect(categoryLabel('ru', 'food')).toBe('Еда');
    expect(categoryLabel('en', 'food')).toBe('Food');
  });

  it('отдаёт подписи режима маршрута', () => {
    expect(routeModeLabel('ru', 'plane')).toContain('Самолёт');
    expect(routeModeAria('en', 'car')).toBe('Car');
  });
});
