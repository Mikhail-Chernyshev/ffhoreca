import {
  cityMatchesQuery,
  cyrillicToLatin,
  fieldMatchesQuery,
  latinSearchHint,
  normalizeSearchText,
  searchQueryVariants,
} from './transliterate';

describe('normalizeSearchText', () => {
  it('обрезает пробелы, приводит к нижнему регистру и заменяет ё на е', () => {
    expect(normalizeSearchText('  Ёлка  ')).toBe('елка');
  });
});

describe('cyrillicToLatin', () => {
  it('транслитерирует кириллицу', () => {
    expect(cyrillicToLatin('Москва')).toBe('moskva');
    expect(cyrillicToLatin('Лови')).toBe('lovi');
  });

  it('убирает символы кроме латиницы, цифр, пробела и дефиса', () => {
    expect(cyrillicToLatin('Foo!')).toBe('foo');
  });
});

describe('searchQueryVariants', () => {
  it('возвращает пустой массив для пустого запроса', () => {
    expect(searchQueryVariants('   ')).toEqual([]);
  });

  it('добавляет латинский вариант, если транслит не короче двух символов', () => {
    expect(searchQueryVariants('Лови')).toEqual(['лови', 'lovi']);
  });

  it('не дублирует вариант, если запрос уже латиница', () => {
    expect(searchQueryVariants('lovi')).toEqual(['lovi']);
  });
});

describe('latinSearchHint', () => {
  it('возвращает null, если в имени нет кириллицы', () => {
    expect(latinSearchHint('Tbilisi')).toBeNull();
  });

  it('возвращает транслит для кириллического имени', () => {
    expect(latinSearchHint('Москва')).toBe('moskva');
  });
});

describe('fieldMatchesQuery', () => {
  it('совпадает по подстроке в нормализованном поле или транслите', () => {
    expect(fieldMatchesQuery('Tbilisi', ['tbil'])).toBe(true);
    expect(fieldMatchesQuery('Лови', ['lovi'])).toBe(true);
  });

  it('не совпадает с пустым полем или чужим запросом', () => {
    expect(fieldMatchesQuery('   ', ['x'])).toBe(false);
    expect(fieldMatchesQuery('Paris', ['rome'])).toBe(false);
  });
});

describe('cityMatchesQuery', () => {
  const tbilisi = { name: 'Tbilisi', id: 'ge-tbilisi', countryCode: 'GE' };

  it('при пустом запросе показывает все города', () => {
    expect(cityMatchesQuery(tbilisi, '  ')).toBe(true);
  });

  it('ищет по имени, id и коду страны', () => {
    expect(cityMatchesQuery(tbilisi, 'tbil')).toBe(true);
    expect(cityMatchesQuery(tbilisi, 'ge-tbilisi')).toBe(true);
    expect(cityMatchesQuery(tbilisi, 'ge')).toBe(true);
  });

  it('не находит чужой город', () => {
    expect(cityMatchesQuery(tbilisi, 'moscow')).toBe(false);
  });
});
