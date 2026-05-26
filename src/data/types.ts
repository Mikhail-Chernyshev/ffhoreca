/** Табы фильтра: что показывать на карте */
export type CategoryFilter =
  | 'all'
  | 'places'
  | 'cities'
  | 'lodging'
  | 'food'
  | 'bar'
  | 'airport';

/** Категории заведения (можно несколько — место попадёт в каждый подходящий таб) */
export type PlaceCategory = 'lodging' | 'food' | 'bar' | 'airport' | 'attraction';

/**
 * Город в каталоге. Граница на карте: опциональный файл `public/geo/cities/{id}.json`
 * (FeatureCollection, GeometryCollection или один Polygon/MultiPolygon).
 */
export interface City {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  lng: number;
  lat: number;
  /** Коротко о городе — для модалки */
  summary?: string;
  /** Заметки о городе */
  story?: string;
  photos?: string[];
}

export interface Place {
  id: string;
  name: string;
  countryCode: string;
  cityId: string;
  categories: PlaceCategory[];
  address: string;
  /** Короткий лид до модалки / для списков */
  summary: string;
  /** null — если нет оценки или не заполняли */
  googleRating: number | null;
  /** URL картинок; null — фото нет (не подставлять заглушки) */
  photos: string[] | null;
  /** Ваш текст про место */
  story: string;
  /** Если не задано — точка берётся из города (+ лёгкий сдвиг, если точек несколько) */
  lng?: number;
  lat?: number;
}

export interface Catalog {
  cities: City[];
  places: Place[];
}

/** Режим транспорта для пользовательских маршрутов */
export type UserRouteMode = 'plane' | 'train' | 'bus' | 'boat' | 'car';

/** Одна точка маршрута */
export interface RouteWaypoint {
  cityId: string;
  name: string;
  lat: number;
  lng: number;
}

/** Маршрут, созданный пользователем */
export interface TravelRoute {
  id: string;
  waypoints: RouteWaypoint[];
  mode: UserRouteMode;
}
