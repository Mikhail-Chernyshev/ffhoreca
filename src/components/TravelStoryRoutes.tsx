import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Catalog } from '../data/types';
import {
  buildTravelStoryRoutes,
  positionAndBearingOneWayOnArc,
  type TravelStoryRoute,
  type TravelVehicleMode,
} from '../lib/travelStoryRoutes';

export const SOURCE_TRAVEL_ARCS = 'travel-story-arcs';
export const LAYER_TRAVEL_ARCS_LINE = 'travel-story-arcs-line';

/** На «районном» зуме линии перегружают карту — только обзор. */
const TRAVEL_ANIM_MAX_ZOOM = 8.85;

function hashPhase(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

function subscribeReducedMotion(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function reducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Props = {
  catalog: Catalog;
  zoom: number;
  mapThemeDark: boolean;
};

function vehicleClass(mode: TravelVehicleMode): string {
  const base = 'world-map-travel-vehicle';
  switch (mode) {
    case 'plane':
      return `${base} world-map-travel-vehicle--plane`;
    case 'bus':
      return `${base} world-map-travel-vehicle--bus`;
    case 'train_highspeed':
      return `${base} world-map-travel-vehicle--train-hst`;
    case 'train_regional':
      return `${base} world-map-travel-vehicle--train-regional`;
    case 'car':
      return `${base} world-map-travel-vehicle--car`;
    case 'bicycle':
      return `${base} world-map-travel-vehicle--bicycle`;
    default:
      return base;
  }
}

function vehicleColor(
  mode: TravelVehicleMode,
  colors: {
    plane: string;
    bus: string;
    trainHigh: string;
    trainRegional: string;
    car: string;
    bicycle: string;
  },
): string {
  switch (mode) {
    case 'plane':
      return colors.plane;
    case 'bus':
      return colors.bus;
    case 'train_highspeed':
      return colors.trainHigh;
    case 'train_regional':
      return colors.trainRegional;
    case 'car':
      return colors.car;
    case 'bicycle':
      return colors.bicycle;
    default:
      return colors.plane;
  }
}

function VehicleGlyph({ mode }: { mode: TravelVehicleMode }) {
  switch (mode) {
    case 'bus':
      return (
        <svg viewBox='0 0 24 24' width={18} height={18} fill='currentColor'>
          <path d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm2.5-6H6V8h13v3z' />
        </svg>
      );
    case 'train_highspeed':
      return (
        <svg viewBox='0 0 24 24' width={18} height={18} fill='currentColor'>
          <path d='M8 3c-2.5 0-4 1.5-4 4v9h16V7c0-2.5-1.5-4-4-4H8zm0 2h8c1.66 0 3 .67 3 1.5S17.66 8 16 8H8C6.34 8 5 7.33 5 6.5S6.34 5 8 5zm-1 13c-.83 0-1.5.67-1.5 1.5S6.17 21 7 21s1.5-.67 1.5-1.5S7.83 18 7 18zm10 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zM5 15v2h14v-2H5z' />
        </svg>
      );
    case 'train_regional':
      return (
        <svg viewBox='0 0 24 24' width={17} height={17} fill='currentColor'>
          <path d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-2.78c.61-.55 1-1.34 1-2.22V9c0-2.5-2-4.5-8-4.5S4 6.5 4 9v7zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM6 10h12v3H6v-3z' />
        </svg>
      );
    case 'car':
      return (
        <svg viewBox='0 0 24 24' width={18} height={18} fill='currentColor'>
          <path d='M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v7c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-7l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z' />
        </svg>
      );
    case 'bicycle':
      return (
        <svg viewBox='0 0 24 24' width={18} height={18} fill='currentColor'>
          <path d='M15.5 5.5c1.38 0 2.5-1.12 2.5-2.5S16.88.5 15.5.5 13 1.62 13 3s1.12 2.5 2.5 2.5zM5 12c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5c0-1.27-.5-2.4-1.3-3.2l2.3-3.9 1.8 3c-.7.6-1.2 1.4-1.2 2.3 0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3h-.8l-2.4-4h2.4v-2h-4l-2 3.5c-.7-.4-1.5-.6-2.4-.6zM5 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm14.5-8c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-1 6c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z' />
        </svg>
      );
    case 'plane':
    default:
      return (
        <svg viewBox='0 0 24 24' width={17} height={17} fill='currentColor'>
          <path d='M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' />
        </svg>
      );
  }
}

function VehicleMarker({
  route,
  colors,
  now,
}: {
  route: TravelStoryRoute;
  colors: {
    plane: string;
    bus: string;
    trainHigh: string;
    trainRegional: string;
    car: string;
    bicycle: string;
  };
  now: number;
}) {
  const cycleMs = route.cycleDurationMs;
  const staggerMs = hashPhase(route.legId) * cycleMs * 0.85;
  const t = now + staggerMs;
  const progress =
    (((t % cycleMs) + cycleMs) % cycleMs) / cycleMs;
  const pos = positionAndBearingOneWayOnArc(route.coordinates, progress);
  if (pos == null) return null;

  const color = vehicleColor(route.mode, colors);

  return (
    <Marker
      longitude={pos.lng}
      latitude={pos.lat}
      anchor='center'
    >
      <span
        className={vehicleClass(route.mode)}
        style={{
          color,
          transform: `rotate(${pos.bearing}deg)`,
        }}
        aria-hidden
      >
        <VehicleGlyph mode={route.mode} />
      </span>
    </Marker>
  );
}

export function TravelStoryRoutes({ catalog, zoom, mapThemeDark }: Props) {
  const routes = useMemo(() => buildTravelStoryRoutes(catalog), [catalog]);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );

  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (reducedMotion) return;
    if (routes.length === 0) return;
    if (zoom > TRAVEL_ANIM_MAX_ZOOM) return;

    let id = 0;
    const loop = () => {
      forceTick();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [reducedMotion, routes.length, zoom]);

  const linesGeo = useMemo((): FeatureCollection<Geometry> => {
    return {
      type: 'FeatureCollection',
      features: routes.map((r) => ({
        type: 'Feature' as const,
        properties: { legId: r.legId, mode: r.mode },
        geometry: {
          type: 'LineString' as const,
          coordinates: r.coordinates,
        },
      })),
    };
  }, [routes]);

  const showLayer = zoom <= TRAVEL_ANIM_MAX_ZOOM && routes.length > 0;

  const lineColor = mapThemeDark
    ? 'rgba(130, 190, 255, 0.55)'
    : 'rgba(36, 92, 158, 0.45)';

  const vehicleColors = mapThemeDark
    ? {
        plane: '#a8d4ff',
        bus: '#ffd599',
        trainHigh: '#7dd3fc',
        trainRegional: '#cbd5e1',
        car: '#c4b5fd',
        bicycle: '#86efac',
      }
    : {
        plane: '#1e4d8c',
        bus: '#b45309',
        trainHigh: '#0369a1',
        trainRegional: '#475569',
        car: '#6d28d9',
        bicycle: '#15803d',
      };

  const now =
    typeof performance !== 'undefined' ? performance.now() : 0;

  if (!showLayer) return null;

  return (
    <>
      <Source id={SOURCE_TRAVEL_ARCS} type='geojson' data={linesGeo}>
        <Layer
          id={LAYER_TRAVEL_ARCS_LINE}
          type='line'
          layout={{
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': lineColor,
            'line-width': 1.35,
            'line-opacity': 0.42,
          }}
        />
      </Source>

      {!reducedMotion
        ? routes.map((route) => (
            <VehicleMarker
              key={route.legId}
              route={route}
              colors={vehicleColors}
              now={now}
            />
          ))
        : null}
    </>
  );
}
