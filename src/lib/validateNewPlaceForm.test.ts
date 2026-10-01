import {
  validateNewPlaceRequired,
  type NewPlaceFormFields,
} from './validateNewPlaceForm';

const valid: NewPlaceFormFields = {
  name: 'Lovard',
  cityId: 'ge-tbilisi',
  countryCode: 'GE',
  address: 'Rustaveli 1',
  summary: 'Bar',
  story: 'Nice place',
  categories: ['bar'],
};

describe('validateNewPlaceRequired', () => {
  it('возвращает null, если все обязательные поля заполнены', () => {
    expect(validateNewPlaceRequired(valid)).toBeNull();
  });

  it('требует название', () => {
    expect(validateNewPlaceRequired({ ...valid, name: '  ' })).toBe(
      'Укажите название места.',
    );
  });

  it('требует город', () => {
    expect(validateNewPlaceRequired({ ...valid, cityId: '' })).toBe(
      'Выберите город.',
    );
  });

  it('требует код страны из двух символов', () => {
    expect(validateNewPlaceRequired({ ...valid, countryCode: 'G' })).toBe(
      'Не удалось определить код страны — выберите город из списка.',
    );
  });

  it('требует адрес, summary, историю и категорию', () => {
    expect(validateNewPlaceRequired({ ...valid, address: '' })).toBe(
      'Укажите адрес.',
    );
    expect(validateNewPlaceRequired({ ...valid, summary: ' ' })).toBe(
      'Заполните краткое описание (summary).',
    );
    expect(validateNewPlaceRequired({ ...valid, story: '' })).toBe(
      'Заполните блок «История / впечатления».',
    );
    expect(validateNewPlaceRequired({ ...valid, categories: [] })).toBe(
      'Выберите категорию.',
    );
  });
});
