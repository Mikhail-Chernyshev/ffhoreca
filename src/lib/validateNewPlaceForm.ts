import type { PlaceCategory } from '../data/types';

export type NewPlaceFormFields = {
  name: string;
  cityId: string;
  countryCode: string;
  address: string;
  summary: string;
  story: string;
  categories: PlaceCategory[];
};

/** Возвращает текст ошибки или null, если всё обязательное заполнено. */
export function validateNewPlaceRequired(
  fields: NewPlaceFormFields,
): string | null {
  if (!fields.name.trim()) return 'Укажите название места.';
  if (!fields.cityId.trim()) return 'Выберите город.';
  if (!fields.countryCode.trim() || fields.countryCode.length !== 2) {
    return 'Не удалось определить код страны — выберите город из списка.';
  }
  if (!fields.address.trim()) return 'Укажите адрес.';
  if (!fields.summary.trim()) return 'Заполните краткое описание (summary).';
  if (!fields.story.trim()) return 'Заполните блок «История / впечатления».';
  if (fields.categories.length === 0) {
    return 'Выберите хотя бы одну категорию.';
  }
  return null;
}
