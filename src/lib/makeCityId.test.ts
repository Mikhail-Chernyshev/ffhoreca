import { makeCityId } from './makeCityId';

describe('makeCityId', () => {
  it('склеивает код страны и slug названия в нижнем регистре', () => {
    expect(makeCityId('GE', 'Tbilisi')).toBe('ge-tbilisi');
  });

  it('заменяет пробелы в названии на дефисы', () => {
    expect(makeCityId('RU', 'Saint Petersburg')).toBe('ru-saint-petersburg');
  });

  it('оставляет кириллицу в slug, не транслитерирует её', () => {
    expect(makeCityId('RU', 'Москва')).toBe('ru-москва');
  });

  it('убирает символы, которые не буква, не цифра и не дефис', () => {
    expect(makeCityId('IT', 'L\'Aquila!')).toBe('it-laquila');
  });

  it('обрезает slug названия до 40 символов', () => {
    const longName = 'a'.repeat(50);
    expect(makeCityId('US', longName)).toBe(`us-${'a'.repeat(40)}`);
  });
});
