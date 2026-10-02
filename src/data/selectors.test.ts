import {
  airportsForRoutePicker,
  atlasCountryAlpha2,
  canonicalCity,
  catalogCitiesListed,
  catalogCountriesListed,
  catalogCityIdFromPhotonHints,
  cityById,
  cityLabelForPlace,
  citiesForMapMarkers,
  formatTabCount,
  geoIdToAlpha2,
  isFineGrainedCity,
  markerColorClass,
  mergeCatalogWithAdminPlaces,
  placeCoordinates,
  placesCountForCity,
  placesForFilter,
  resolvePlaceCityId,
  resolveRouteWaypointCoords,
  visitedCountryCodes,
} from './selectors';
import { catalog, city, place } from '../test/fixtures';

const tbilisi = city({ id: 'ge-tbilisi', name: 'Tbilisi', countryCode: 'GE' });
const moscow = city({
  id: 'ru-moscow',
  name: 'Moscow',
  countryCode: 'RU',
  lat: 55.7558,
  lng: 37.6173,
});
const bangkok = city({
  id: 'th-bangkok',
  name: 'Bangkok',
  countryCode: 'TH',
  lat: 13.7563,
  lng: 100.5018,
});
const khwaeng = city({
  id: 'th-khwaeng-wat-arun',
  name: 'Khwaeng Wat Arun',
  countryCode: 'TH',
  lat: 13.7436,
  lng: 100.4889,
});

const food = place({
  id: 'p-food',
  name: 'Cafe',
  cityId: 'ge-tbilisi',
  categories: ['food'],
});
const attraction = place({
  id: 'p-attr',
  name: 'Museum',
  cityId: 'ge-tbilisi',
  categories: ['attraction'],
});
const airport = place({
  id: 'p-air',
  name: 'TBS',
  cityId: 'ge-tbilisi',
  categories: ['airport'],
  lat: 41.669,
  lng: 44.955,
});
const inKhwaeng = place({
  id: 'p-th',
  name: 'Temple cafe',
  cityId: khwaeng.id,
  countryCode: 'TH',
  lat: khwaeng.lat,
  lng: khwaeng.lng,
});

const full = catalog({
  cities: [tbilisi, moscow, bangkok, khwaeng],
  places: [food, attraction, airport, inKhwaeng],
});

describe('geoIdToAlpha2 / atlasCountryAlpha2', () => {
  it('переводит numeric id world-atlas в ISO alpha-2', () => {
    expect(geoIdToAlpha2(268)).toBe('GE');
    expect(geoIdToAlpha2(276)).toBe('DE');
    expect(geoIdToAlpha2(undefined)).toBeUndefined();
  });

  it('если id нет — берёт известное английское имя', () => {
    expect(atlasCountryAlpha2({ properties: { name: 'Italy' } })).toBe('IT');
    expect(atlasCountryAlpha2({ properties: { name: 'Unknownland' } })).toBeUndefined();
  });
});

describe('visitedCountryCodes', () => {
  it('собирает коды из городов и мест', () => {
    expect(visitedCountryCodes(full)).toEqual(new Set(['GE', 'RU', 'TH']));
  });
});

describe('catalogCountriesListed', () => {
  it('собирает страны из городов и мест, без подрайонов в счётчике городов', () => {
    const rows = catalogCountriesListed(full);
    expect(rows.map((r) => r.code).sort()).toEqual(['GE', 'RU', 'TH']);
    expect(rows.find((r) => r.code === 'TH')).toEqual(
      expect.objectContaining({ code: 'TH', citiesCount: 1, placesCount: 1 }),
    );
    expect(rows.find((r) => r.code === 'GE')).toEqual(
      expect.objectContaining({ code: 'GE', citiesCount: 1, placesCount: 3 }),
    );
  });
});

describe('isFineGrainedCity / catalogCitiesListed', () => {
  it('считает khwaeng подрайоном, а не городом для списков', () => {
    expect(isFineGrainedCity(khwaeng)).toBe(true);
    expect(isFineGrainedCity(bangkok)).toBe(false);
    expect(catalogCitiesListed(full).map((c) => c.id)).toEqual(
      expect.not.arrayContaining([khwaeng.id]),
    );
    expect(catalogCitiesListed(full).map((c) => c.id)).toEqual(
      expect.arrayContaining(['ge-tbilisi', 'th-bangkok']),
    );
  });
});

describe('canonicalCity / cityLabelForPlace / placesCountForCity', () => {
  it('подрайон привязывает к ближайшему настоящему городу той же страны', () => {
    expect(canonicalCity(full, khwaeng.id, { lat: khwaeng.lat, lng: khwaeng.lng })?.id).toBe(
      'th-bangkok',
    );
    expect(cityLabelForPlace(full, inKhwaeng)).toBe('Bangkok');
    expect(placesCountForCity(full, 'th-bangkok')).toBe(1);
  });

  it('обычный город остаётся собой', () => {
    expect(canonicalCity(full, 'ge-tbilisi')?.id).toBe('ge-tbilisi');
    expect(cityById(full, 'ge-tbilisi')).toBe(tbilisi);
  });
});

describe('placesForFilter', () => {
  it('таб places показывает только attraction', () => {
    expect(placesForFilter(full, 'places').map((p) => p.id)).toEqual(['p-attr']);
  });

  it('таб food показывает еду, cities не показывает места', () => {
    expect(placesForFilter(full, 'food').map((p) => p.id)).toEqual(['p-food', 'p-th']);
    expect(placesForFilter(full, 'cities')).toEqual([]);
    expect(placesForFilter(full, 'all')).toHaveLength(4);
  });
});

describe('citiesForMapMarkers', () => {
  it('на «все» отдаёт настоящие города без подрайонов', () => {
    const ids = citiesForMapMarkers(full, 'all', full.places).map((c) => c.id);
    expect(ids).not.toContain(khwaeng.id);
    expect(ids).toContain('th-bangkok');
  });

  it('на табе категории оставляет города видимых мест', () => {
    const ids = citiesForMapMarkers(full, 'airport', [airport]).map((c) => c.id);
    expect(ids).toEqual(['ge-tbilisi']);
  });
});

describe('catalogCityIdFromPhotonHints / resolvePlaceCityId', () => {
  it('находит город по locality hint', () => {
    expect(
      catalogCityIdFromPhotonHints(full, tbilisi.lat, tbilisi.lng, ['Tbilisi'], 'GE'),
    ).toBe('ge-tbilisi');
  });

  it('resolvePlaceCityId склеивает подсказку с каталогом и поднимает подрайон', () => {
    expect(
      resolvePlaceCityId(full, [], {
        lat: khwaeng.lat,
        lng: khwaeng.lng,
        localityHints: ['Khwaeng Wat Arun', 'Bangkok'],
        countryCodeOsm: 'TH',
        cityName: 'Bangkok',
      }),
    ).toBe('th-bangkok');
  });

  it('без кода страны и без совпадения возвращает undefined', () => {
    expect(
      resolvePlaceCityId(catalog(), [], {
        lat: 0,
        lng: 0,
        localityHints: [],
      }),
    ).toBeUndefined();
  });
});

describe('placeCoordinates / airportsForRoutePicker / resolveRouteWaypointCoords', () => {
  it('берёт координаты места, если они заданы', () => {
    expect(placeCoordinates(full, airport)).toEqual([44.955, 41.669]);
  });

  it('собирает аэропорты для пикера', () => {
    const opts = airportsForRoutePicker(full);
    expect(opts).toHaveLength(1);
    expect(opts[0]).toMatchObject({
      placeId: 'p-air',
      name: 'TBS',
      cityId: 'ge-tbilisi',
    });
  });

  it('для самолёта подставляет единственный аэропорт города', () => {
    expect(
      resolveRouteWaypointCoords(
        full,
        { cityId: 'ge-tbilisi', lat: 0, lng: 0 },
        'plane',
      ),
    ).toEqual([44.955, 41.669]);
  });

  it('для не-самолёта оставляет координаты waypoint', () => {
    expect(
      resolveRouteWaypointCoords(
        full,
        { cityId: 'ge-tbilisi', lat: 1, lng: 2 },
        'car',
      ),
    ).toEqual([2, 1]);
  });
});

describe('formatTabCount / markerColorClass / mergeCatalogWithAdminPlaces', () => {
  it('форматирует счётчик таба', () => {
    expect(formatTabCount(5)).toBe('5');
    expect(formatTabCount(100)).toBe('99+');
    expect(formatTabCount(-3)).toBe('0');
  });

  it('цвет маркера берёт первую категорию из lodging/food/bar/airport', () => {
    expect(markerColorClass(place({ id: '1', name: 'H', cityId: 'x', categories: ['lodging', 'food'] }))).toBe(
      'place-dot--lodging',
    );
    expect(markerColorClass(attraction)).toBe('place-dot--food');
  });

  it('админские места перекрывают id и добавляют новые', () => {
    const updated = { ...food, name: 'Cafe v2' };
    const extra = place({ id: 'p-new', name: 'New', cityId: 'ge-tbilisi' });
    const merged = mergeCatalogWithAdminPlaces(full, [updated, extra]);
    expect(merged.places.find((p) => p.id === 'p-food')?.name).toBe('Cafe v2');
    expect(merged.places.some((p) => p.id === 'p-new')).toBe(true);
    expect(mergeCatalogWithAdminPlaces(full, [])).toBe(full);
  });
});
