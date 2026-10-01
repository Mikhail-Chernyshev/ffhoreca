import { setAppLocale } from '../i18n/localeStore';
import {
  isForeignScriptName,
  photonLangForQuery,
  pickReadablePlaceName,
  searchLanguageForQuery,
} from './searchLocale';

describe('searchLanguageForQuery', () => {
  afterEach(() => {
    setAppLocale('en');
  });

  it('кириллица → ru, латиница → en', () => {
    expect(searchLanguageForQuery('Москва')).toBe('ru');
    expect(searchLanguageForQuery('Paris')).toBe('en');
  });

  it('без букв берёт локаль приложения', () => {
    setAppLocale('ru');
    expect(searchLanguageForQuery('123')).toBe('ru');
    setAppLocale('en');
    expect(searchLanguageForQuery('123')).toBe('en');
  });
});

describe('photonLangForQuery', () => {
  afterEach(() => {
    setAppLocale('en');
  });

  it('для латинского запроса отдаёт en', () => {
    setAppLocale('ru');
    expect(photonLangForQuery('Tbilisi')).toBe('en');
  });

  it('для кириллицы при русской локали отдаёт default', () => {
    setAppLocale('ru');
    expect(photonLangForQuery('Тбилиси')).toBe('default');
  });

  it('при английской локали всегда en', () => {
    setAppLocale('en');
    expect(photonLangForQuery('Тбилиси')).toBe('en');
  });
});

describe('isForeignScriptName / pickReadablePlaceName', () => {
  it('считает арабское имя чужим для кириллического запроса', () => {
    expect(isForeignScriptName('دبي', 'Дубай')).toBe(true);
  });

  it('для кириллического запроса подменяет арабское имя на читаемый вариант', () => {
    expect(pickReadablePlaceName('دبي', 'Дубай', ['Дубай', 'Dubai'])).toBe('Дубай');
    expect(pickReadablePlaceName('دبي', 'Дубай', ['Dubai'])).toBe('Dubai');
  });

  it('для латинского запроса арабское имя не считает чужим', () => {
    expect(pickReadablePlaceName('دبي', 'Dubai', ['Dubai'])).toBe('دبي');
  });

  it('оставляет имя, если вязь не чужая', () => {
    expect(pickReadablePlaceName('Tbilisi', 'tbil', [])).toBe('Tbilisi');
  });
});
