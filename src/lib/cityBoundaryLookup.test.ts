import { cityBoundarySearchQueries, localGeoBoundaryIds } from './cityBoundaryLookup';
import { city } from '../test/fixtures';

describe('localGeoBoundaryIds', () => {
  it('для латинского slug оставляет id', () => {
    expect(localGeoBoundaryIds(city({ id: 'ge-tbilisi', name: 'Tbilisi' }))).toEqual([
      'ge-tbilisi',
    ]);
  });

  it('для кириллицы в id добавляет латинский вариант', () => {
    const ids = localGeoBoundaryIds(city({ id: 'ge-тбилиси', name: 'Тбилиси' }));
    expect(ids).toContain('ge-тбилиси');
    expect(ids).toContain('ge-tbilisi');
  });
});

describe('cityBoundarySearchQueries', () => {
  it('кладёт имя, транслит и slug', () => {
    const q = cityBoundarySearchQueries(city({ id: 'ge-tbilisi', name: 'Тбилиси' }));
    expect(q).toEqual(expect.arrayContaining(['Тбилиси', 'tbilisi']));
  });

  it('для Бангкока добавляет алиас bangkok', () => {
    const q = cityBoundarySearchQueries(
      city({ id: 'th-bangkok', name: 'กรุงเทพมหานคร', countryCode: 'TH' }),
    );
    expect(q.map((s) => s.toLowerCase())).toContain('bangkok');
  });
});
