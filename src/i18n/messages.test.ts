import { translate } from './messages';

describe('translate', () => {
  it('достаёт строку по точечному ключу', () => {
    expect(translate('ru', 'common.cancel')).toBe('Отмена');
  });

  it('подставляет {{vars}}', () => {
    expect(translate('en', 'limits.reachedCountries', { n: 10 })).toBe(
      'Freemium limit: up to 10 countries. Upgrade to Premium.',
    );
  });

  it('неизвестный ключ возвращает как есть', () => {
    expect(translate('ru', 'no.such.key')).toBe('no.such.key');
  });
});
