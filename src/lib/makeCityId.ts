/** Генерируем id города из кода страны + нормализованного названия */
export function makeCityId(countryCode: string, cityName: string): string {
  const slug = cityName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9-]/gi, '')
    .slice(0, 40);
  return `${countryCode.toLowerCase()}-${slug}`;
}
