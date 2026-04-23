import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import Map, {
  AttributionControl,
  Layer,
  Marker,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { feature } from 'topojson-client';
import { useCityBoundaryGeography } from '../hooks/useCityBoundaryGeography';
import type { Catalog, CategoryFilter, City, Place } from '../data/types';
import {
  atlasCountryAlpha2,
  markerColorClass,
  placeCoordinates,
  visitedCountryCodes,
} from '../data/selectors';
import {
  fixGeojsonAntimeridian,
  sanitizeMapFillGeometry,
} from '../lib/fixGeojsonAntimeridian';

/** Топология world-atlas countries-10m (подгружается async — файл ~3.5 MB). */
type Countries10mTopology = typeof import('world-atlas/countries-10m.json');

const EMPTY_COUNTRIES_GEO: FeatureCollection<Geometry, GeoJsonProperties> = {
  type: 'FeatureCollection',
  features: [],
};

function countriesVisitedGeoJson(
  visited: Set<string>,
  worldTopology: Countries10mTopology,
): FeatureCollection<Geometry, GeoJsonProperties> {
  const raw = feature(
    worldTopology as unknown as Parameters<typeof feature>[0],
    worldTopology.objects.countries as Parameters<typeof feature>[1],
  ) as unknown as FeatureCollection<Geometry, GeoJsonProperties>;
  const features = raw.features.flatMap((f) => {
    const alpha2 = atlasCountryAlpha2({
      id: f.id as string | number | undefined,
      properties: f.properties as { name?: string } | undefined,
    });
    const isVisited = alpha2 != null && visited.has(alpha2);
    const prev =
      f.properties != null && typeof f.properties === 'object'
        ? (f.properties as GeoJsonProperties)
        : {};
    const geometry = sanitizeMapFillGeometry(
      fixGeojsonAntimeridian(f.geometry),
    );
    if (geometry == null) {
      return [];
    }
    return [
      {
        type: 'Feature' as const,
        id: f.id,
        geometry,
        properties: {
          ...prev,
          visited: isVisited,
        },
      },
    ];
  });
  return { type: 'FeatureCollection', features };
}

const LAYER_CARTO_BASE = 'carto-base';
const LAYER_ATLAS_COUNTRIES_FILL = 'atlas-countries-fill';
const LAYER_CITY_BOUNDARIES_FILL = 'city-boundaries-fill';
const LAYER_CITY_BOUNDARIES_LINE = 'city-boundaries-line';

/** Растровые тайлы: детализация (дороги, реки, подписи) растёт с зумом автоматически. */
const CARTO_RASTER_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution:
        '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a> ' +
        '<a href="https://carto.com/attributions">© CARTO</a>',
    },
  },
  layers: [
    {
      id: LAYER_CARTO_BASE,
      type: 'raster',
      source: 'carto',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
} satisfies StyleSpecification;

/**
 * Снизу вверх: растр CARTO → заливка стран → заливка границы города → линия границы.
 * Иначе после обновления GeoJSON слой стран может оказаться выше оранжевой заливки города.
 */
function reorderWorldMapLayers(map: MapLibreMap): void {
  if (!map.isStyleLoaded()) return;
  if (!map.getLayer(LAYER_CARTO_BASE) || !map.getLayer(LAYER_ATLAS_COUNTRIES_FILL)) {
    return;
  }

  const hasCity =
    map.getLayer(LAYER_CITY_BOUNDARIES_FILL) &&
    map.getLayer(LAYER_CITY_BOUNDARIES_LINE);

  if (hasCity) {
    map.moveLayer(LAYER_CITY_BOUNDARIES_LINE);
    map.moveLayer(LAYER_CITY_BOUNDARIES_FILL, LAYER_CITY_BOUNDARIES_LINE);
    map.moveLayer(LAYER_ATLAS_COUNTRIES_FILL, LAYER_CITY_BOUNDARIES_FILL);
    map.moveLayer(LAYER_CARTO_BASE, LAYER_ATLAS_COUNTRIES_FILL);
  } else {
    map.moveLayer(LAYER_CARTO_BASE, LAYER_ATLAS_COUNTRIES_FILL);
  }
}

const MAP_MIN_ZOOM = 0.85;
const MAP_MAX_ZOOM = 19;
const MAP_DEFAULT_ZOOM = 1.42;
const MAP_DEFAULT_LONGITUDE = 0;
const MAP_DEFAULT_LATITUDE = 18;

/** Заливка стран только на обзорном зуме; при приближении скрывается (слой maxzoom). */
const COUNTRY_FILL_LAYER_MAX_ZOOM = 5;
/** При клике по городу — уровень «район / улицы» (тайлы сами подтянут дорожную сеть). */
const CITY_FOCUS_ZOOM = 12.5;
/** Рыбный текст блока «О проекте» (заменить на реальное описание). */
const PROJECT_ABOUT_PLACEHOLDER = `Здесь появится развёрнутое описание проекта ffhoreca: для кого каталог, откуда данные, как устроена карта и фильтры. Пока ниже — типографская рыба, чтобы проверить раскрытие и прокрутку.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vehicula, nibh non fermentum dictum, ligula ante sollicitudin odio, vel blandit augue velit nec turpis. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec vitae libero vitae urna bibendum tincidunt.

Suspendisse potenti. Mauris faucibus, nulla id ultricies lacinia, metus lacus tristique massa, vitae pulvinar lectus lacus sit amet tellus. Cras imperdiet, risus vitae dignissim faucibus, lacus tortor commodo urna, at sagittis lectus erat id nisl. Phasellus id sapien nec nulla convallis faucibus.

Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Ut at tortor vitae nisl pretium dictum. Curabitur euismod, felis sit amet vehicula bibendum, urna elit varius nunc, sed faucibus eros tortor a nisl. Aliquam erat volutpat.

Nam euismod ligula id lacus feugiat, sed luctus urna dictum. Etiam faucibus urna id nisl consequat, vitae tempor magna laoreet. Duis vel nisl ac mi consequat bibendum. Morbi sit amet nibh vel velit cursus pharetra. Integer id nulla nec urna efficitur tincidunt.

Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor. Aenean lacinia bibendum nulla sed consectetur. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh, ut fermentum massa justo sit amet risus.`;

/** Подписи городов */
const CITY_LABEL_MIN_ZOOM = 3.6;
const CITY_LABEL_COMPACT_ZOOM = 9.5;
/** Точки заведений */
const PLACE_MARKERS_MIN_ZOOM = 9.75;
const PLACE_LABEL_HIGH_ZOOM = 14;
/** Полигоны границ городов — не на глобальном обзоре */
const CITY_BOUNDARY_MIN_ZOOM = 7.2;

type Props = {
  catalog: Catalog;
  filter: CategoryFilter;
  places: Place[];
  onPlaceClick: (place: Place) => void;
  onCityClick?: (city: City) => void;
};

export type WorldMapRef = {
  /** Приближение к точке как при клике по городу на карте. */
  flyToLngLat: (lng: number, lat: number) => void;
};

export const WorldMap = forwardRef<WorldMapRef, Props>(function WorldMap(
  { catalog, filter, places, onPlaceClick, onCityClick },
  ref,
) {
  const showCityLayer = filter !== 'places';
  const { geography: cityBoundaryGeo } = useCityBoundaryGeography(
    showCityLayer ? catalog.cities : [],
  );
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);
  const cityClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [zoom, setZoom] = useState(MAP_DEFAULT_ZOOM);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [mapThemeDark, setMapThemeDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  const visited = useMemo(() => visitedCountryCodes(catalog), [catalog]);

  const [countriesTopology, setCountriesTopology] =
    useState<Countries10mTopology | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import('world-atlas/countries-10m.json').then((mod) => {
      if (!cancelled) setCountriesTopology(mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const countriesGeo = useMemo(() => {
    if (countriesTopology == null) return EMPTY_COUNTRIES_GEO;
    return countriesVisitedGeoJson(visited, countriesTopology);
  }, [visited, countriesTopology]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setMapThemeDark(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /**
   * Растровый тайл рисует подписи в одном PNG — заливка стран не может оказаться «между»
   * подложкой и текстом; только низкая альфа, чтобы подписи читались сквозь тон.
   */
  const countryFillPaint = useMemo(
    () => ({
      'fill-antialias': false,
      'fill-color': [
        'case',
        ['==', ['get', 'visited'], true],
        mapThemeDark ? 'rgba(62, 107, 74, 0.32)' : 'rgba(95, 165, 115, 0.3)',
        mapThemeDark ? 'rgba(42, 49, 64, 0.16)' : 'rgba(238, 244, 240, 0.2)',
      ],
    }),
    [mapThemeDark],
  );

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) reorderWorldMapLayers(map);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flyToLngLat: (lng: number, lat: number) => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        const z = Math.max(CITY_FOCUS_ZOOM, map.getZoom());
        map.flyTo({
          center: [lng, lat],
          zoom: Math.min(MAP_MAX_ZOOM, z),
          duration: 750,
        });
      },
    }),
    [],
  );

  const handleZoomIn = useCallback(() => {
    mapRef.current?.getMap()?.zoomIn({ duration: 200 });
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.getMap()?.zoomOut({ duration: 200 });
  }, []);

  const handleResetView = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.flyTo({
      center: [MAP_DEFAULT_LONGITUDE, MAP_DEFAULT_LATITUDE],
      zoom: MAP_DEFAULT_ZOOM,
      duration: 550,
    });
  }, []);

  const zoomToCity = useCallback((city: City) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const z = Math.max(CITY_FOCUS_ZOOM, map.getZoom());
    map.flyTo({
      center: [city.lng, city.lat],
      zoom: Math.min(MAP_MAX_ZOOM, z),
      duration: 750,
    });
  }, []);

  const handleCityZoom = useCallback(
    (city: City) => {
      zoomToCity(city);
    },
    [zoomToCity],
  );

  const handleCityOpenCard = useCallback(
    (city: City) => {
      onCityClick?.(city);
    },
    [onCityClick],
  );

  /** Одиночный клик с задержкой, чтобы dblclick успел отменить зум и открыть только карточку. */
  const scheduleCityZoomOnClick = useCallback(
    (city: City) => {
      if (cityClickTimerRef.current) {
        clearTimeout(cityClickTimerRef.current);
      }
      cityClickTimerRef.current = setTimeout(() => {
        cityClickTimerRef.current = null;
        handleCityZoom(city);
      }, 280);
    },
    [handleCityZoom],
  );

  const cancelScheduledCityZoom = useCallback(() => {
    if (cityClickTimerRef.current) {
      clearTimeout(cityClickTimerRef.current);
      cityClickTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cityClickTimerRef.current) {
        clearTimeout(cityClickTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const showCityBoundaries =
    showCityLayer &&
    cityBoundaryGeo != null &&
    zoom >= CITY_BOUNDARY_MIN_ZOOM;

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const run = () => reorderWorldMapLayers(map);
    if (map.isStyleLoaded()) run();
    map.on('idle', run);
    map.on('styledata', run);
    return () => {
      map.off('idle', run);
      map.off('styledata', run);
    };
  }, [countriesGeo, showCityBoundaries]);

  const showPlaceMarkers = zoom >= PLACE_MARKERS_MIN_ZOOM;
  const placeLabelHigh = zoom >= PLACE_LABEL_HIGH_ZOOM;

  useLayoutEffect(() => {
    if (!aboutExpanded) return;
    const id = window.setTimeout(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        left: 0,
        behavior: 'smooth',
      });
    }, 420);
    return () => window.clearTimeout(id);
  }, [aboutExpanded]);

  const handleAboutChevronClick = useCallback(() => {
    setAboutExpanded((v) => !v);
  }, []);

  const handleAboutLinkClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setAboutExpanded(true);
  }, []);

  return (
    <div className='world-map-wrap' ref={mapWrapRef}>
      <div className='world-map-zoom-controls maplibregl-ctrl maplibregl-ctrl-group'>
        <button
          type='button'
          className='maplibregl-ctrl-zoom-in'
          aria-label='Приблизить'
          onClick={handleZoomIn}
        >
          <span className='maplibregl-ctrl-icon' aria-hidden />
        </button>
        <button
          type='button'
          className='maplibregl-ctrl-zoom-out'
          aria-label='Отдалить'
          onClick={handleZoomOut}
        >
          <span className='maplibregl-ctrl-icon' aria-hidden />
        </button>
        <button
          type='button'
          className='world-map-zoom-controls__reset'
          aria-label='Сбросить масштаб и положение карты'
          title='Исходный вид'
          onClick={handleResetView}
        >
          ⌂
        </button>
      </div>
      <Map
        ref={mapRef}
        mapStyle={CARTO_RASTER_STYLE}
        initialViewState={{
          longitude: MAP_DEFAULT_LONGITUDE,
          latitude: MAP_DEFAULT_LATITUDE,
          zoom: MAP_DEFAULT_ZOOM,
        }}
        minZoom={MAP_MIN_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
        style={{ width: '100%', height: 'min(52vh, 500px)', minHeight: 360 }}
        reuseMaps
        /** Иначе по умолчанию true — дубликаты мира у ±180° дают «полосу» на заливке (Россия и др.). */
        renderWorldCopies={false}
        onLoad={handleMapLoad}
        onMove={(e) => setZoom(e.viewState.zoom)}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        cursor='grab'
        attributionControl={false}
      >
        <AttributionControl compact position='bottom-right' />

        <Source
          id='atlas-countries'
          type='geojson'
          data={countriesGeo}
        >
          <Layer
            id={LAYER_ATLAS_COUNTRIES_FILL}
            type='fill'
            maxzoom={COUNTRY_FILL_LAYER_MAX_ZOOM}
            paint={countryFillPaint as never}
          />
        </Source>

        {showCityBoundaries ? (
          <Source
            id='city-boundaries'
            type='geojson'
            data={
              cityBoundaryGeo as FeatureCollection<Geometry, GeoJsonProperties>
            }
          >
            <Layer
              id={LAYER_CITY_BOUNDARIES_FILL}
              type='fill'
              paint={{
                'fill-color': 'rgba(255, 152, 0, 0.36)',
              }}
            />
            <Layer
              id={LAYER_CITY_BOUNDARIES_LINE}
              type='line'
              paint={{
                'line-color': 'rgba(230, 81, 0, 0.92)',
                'line-width': 2,
              }}
            />
          </Source>
        ) : null}

        {showCityLayer
          ? catalog.cities.map((city) => (
              <Marker
                key={city.id}
                longitude={city.lng}
                latitude={city.lat}
                anchor='center'
              >
                <button
                  type='button'
                  className='world-map-city-marker'
                  aria-label={`Приблизить карту к ${city.name}; двойной клик — карточка города`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    scheduleCityZoomOnClick(city);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    cancelScheduledCityZoom();
                    handleCityOpenCard(city);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      cancelScheduledCityZoom();
                      handleCityZoom(city);
                    }
                  }}
                >
                  <span className='world-map-city-marker__hit' aria-hidden />
                  <span className='world-map-city-marker__dot' />
                  {zoom >= CITY_LABEL_MIN_ZOOM ? (
                    <span
                      className={
                        zoom >= CITY_LABEL_COMPACT_ZOOM
                          ? 'world-map-city-marker__label world-map-city-marker__label--compact'
                          : 'world-map-city-marker__label'
                      }
                    >
                      {city.name}
                    </span>
                  ) : null}
                </button>
              </Marker>
            ))
          : null}

        {showPlaceMarkers
          ? places.map((place) => {
              const [lng, lat] = placeCoordinates(catalog, place);
              const dotClass = `world-map-place-marker__core place-dot ${markerColorClass(place)}`;
              return (
                <Marker key={place.id} longitude={lng} latitude={lat} anchor='center'>
                  <button
                    type='button'
                    className='world-map-place-marker'
                    aria-label={place.name}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaceClick(place);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPlaceClick(place);
                      }
                    }}
                  >
                    <span className='world-map-place-marker__halo' aria-hidden />
                    <span className={dotClass} />
                    <span
                      className={
                        placeLabelHigh
                          ? 'world-map-place-marker__label world-map-place-marker__label--high'
                          : 'world-map-place-marker__label'
                      }
                    >
                      {place.name}
                    </span>
                  </button>
                </Marker>
              );
            })
          : null}
      </Map>
      <div className='world-map-hint-panel'>
        <div className='world-map-about'>
          <a
            href='#project-about-details'
            className='world-map-about__link'
            onClick={handleAboutLinkClick}
          >
            О проекте
          </a>
          <button
            type='button'
            className={
              aboutExpanded
                ? 'world-map-about__chevron world-map-about__chevron--open'
                : 'world-map-about__chevron'
            }
            aria-expanded={aboutExpanded}
            aria-controls='project-about-details'
            id='project-about-summary'
            aria-label={
              aboutExpanded
                ? 'Свернуть описание проекта'
                : 'Развернуть описание проекта'
            }
            onClick={handleAboutChevronClick}
          >
            <span className='world-map-about__chevron-icon' aria-hidden>
              ▼
            </span>
          </button>
        </div>
        <div
          id='project-about-details'
          className={
            aboutExpanded
              ? 'world-map-about-details world-map-about-details--open'
              : 'world-map-about-details'
          }
          role='region'
          aria-labelledby='project-about-summary'
          {...(!aboutExpanded ? { 'aria-hidden': true as const } : {})}
        >
          <div className='world-map-about-details__inner'>
            {PROJECT_ABOUT_PLACEHOLDER.split('\n\n').map((chunk, i) => (
              <p key={i} className='world-map-about-details__p'>
                {chunk}
              </p>
            ))}
          </div>
        </div>
        <p className='world-map-hint' aria-live='polite'>
          <span className='world-map-hint__zoom'>
            Подложка — растровые тайлы OpenStreetMap (CARTO);
             {/* полупрозрачная заливка стран
            world-atlas 10m только при зуме не выше {COUNTRY_FILL_LAYER_MAX_ZOOM} (на приближении
            скрывается). Оранжевая зона города — выше слоя стран. Слева вверху: зум ± и сброс вида.
            Подписи и дороги в одном PNG с подложкой. При приближении на тайлах появляются реки и
            дороги. Границы городов
            из файлов — после приближения. Клик по точке города — приближение;
            двойной клик — карточка города. */}
          </span>{' '}
          Файлы границ:{' '}
          <code className='world-map-hint__code'>
            public/geo/cities/{'{id}'}.json
          </code>{' '}
          (OSM). Цветная точка — заведение.{' '}
          {filter === 'places'
            ? 'Все заведения из каталога; города и их границы скрыты. Заведения — после приближения.'
            : filter === 'cities'
              ? 'Только города; заведения скрыты.'
              : filter === 'all'
                ? 'Без GeoJSON у города — только точка; заведения — после приближения.'
                : filter === 'airport'
                  ? 'Только аэропорты (после приближения).'
                  : 'Заведения по табу — после приближения.'}
        </p>
      </div>
    </div>
  );
});

WorldMap.displayName = 'WorldMap';
