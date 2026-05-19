import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { FeatureCollection, Geometry } from 'geojson';
import type { TravelRoute, UserRouteMode } from '../data/types';
import { greatCircleArc, type LngLatDeg } from '../lib/greatCircle';
import { positionAndBearingOneWayOnArc } from '../lib/travelStoryRoutes';

const SOURCE_USER_ROUTES = 'user-routes';
const LAYER_USER_ROUTES_LINE = 'user-routes-line';
// Скорость анимации аналогично TravelStoryRoutes
const PLANE_VISUAL_SPEED_KMH = 900;
const SPEED_RATIO: Record<UserRouteMode, number> = {
  plane: 3.5, // на ~350% быстрее базовой скорости
  train: 0.25,
  bus:   0.28,
  boat:  0.12,
};

function haversineKm(a: LngLatDeg, b: LngLatDeg): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) *
      Math.cos((b[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

function polylineLengthKm(coords: LngLatDeg[]): number {
  let d = 0;
  for (let i = 0; i < coords.length - 1; i++) d += haversineKm(coords[i]!, coords[i + 1]!);
  return d;
}

const MIN_CYCLE_MS = 6_000;
const MAX_CYCLE_MS = 420_000;

function cycleDurationMs(km: number, mode: UserRouteMode): number {
  const speed = PLANE_VISUAL_SPEED_KMH * SPEED_RATIO[mode];
  const raw = (km / speed) * 3_600_000;
  return Math.min(MAX_CYCLE_MS, Math.max(MIN_CYCLE_MS, raw));
}

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

// ---------------------------------------------------------------------------
// Иконки транспорта
// ---------------------------------------------------------------------------
function VehicleGlyph({ mode }: { mode: UserRouteMode }) {
  switch (mode) {
    case 'train':
      return (
        <svg viewBox='0 0 24 24' width={17} height={17} fill='currentColor'>
          <path d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-2.78c.61-.55 1-1.34 1-2.22V9c0-2.5-2-4.5-8-4.5S4 6.5 4 9v7zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM6 10h12v3H6v-3z' />
        </svg>
      );
    case 'bus':
      return (
        <svg viewBox='0 0 24 24' width={18} height={18} fill='currentColor'>
          <path d='M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm2.5-6H6V8h13v3z' />
        </svg>
      );
    case 'boat':
      return (
        <svg viewBox='0 0 24 24' width={18} height={18} fill='currentColor'>
          <path d='M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.64 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.06.78L3.95 19z' />
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

const MODE_COLORS_DARK: Record<UserRouteMode, string> = {
  plane: '#a8d4ff',
  train: '#cbd5e1',
  bus:   '#ffd599',
  boat:  '#67e8f9',
};

const MODE_COLORS_LIGHT: Record<UserRouteMode, string> = {
  plane: '#1e4d8c',
  train: '#475569',
  bus:   '#b45309',
  boat:  '#0e7490',
};

// ---------------------------------------------------------------------------
// Тип сегмента для анимации
// ---------------------------------------------------------------------------
type AnimSegment = {
  id: string;
  mode: UserRouteMode;
  coordinates: LngLatDeg[];
  cycleDurationMs: number;
};

// ---------------------------------------------------------------------------
// Компонент маркера транспортного средства
// ---------------------------------------------------------------------------
function VehicleMarker({
  seg,
  color,
  now,
}: {
  seg: AnimSegment;
  color: string;
  now: number;
}) {
  const stagger = hashPhase(seg.id) * seg.cycleDurationMs * 0.85;
  const progress = (((now + stagger) % seg.cycleDurationMs) + seg.cycleDurationMs) % seg.cycleDurationMs / seg.cycleDurationMs;
  const pos = positionAndBearingOneWayOnArc(seg.coordinates, progress);
  if (pos == null) return null;

  return (
    <Marker longitude={pos.lng} latitude={pos.lat} anchor='center'>
      <span
        className='world-map-travel-vehicle'
        style={{ color, transform: `rotate(${pos.bearing}deg)` }}
        aria-hidden
      >
        <VehicleGlyph mode={seg.mode} />
      </span>
    </Marker>
  );
}

// ---------------------------------------------------------------------------
// Основной компонент
// ---------------------------------------------------------------------------
type Props = {
  routes: TravelRoute[];
  mapThemeDark: boolean;
};

export function UserRoutes({ routes, mapThemeDark }: Props) {
  const segments = useMemo((): AnimSegment[] => {
    const result: AnimSegment[] = [];
    for (const route of routes) {
      for (let i = 0; i < route.waypoints.length - 1; i++) {
        const from = route.waypoints[i]!;
        const to = route.waypoints[i + 1]!;
        const coordinates = greatCircleArc(from.lng, from.lat, to.lng, to.lat, 56);
        const km = polylineLengthKm(coordinates);
        result.push({
          id: `${route.id}-${i}`,
          mode: route.mode,
          coordinates,
          cycleDurationMs: cycleDurationMs(km, route.mode),
        });
      }
    }
    return result;
  }, [routes]);

  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (reducedMotion || segments.length === 0) return;
    let id = 0;
    const loop = () => { forceTick(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [reducedMotion, segments.length]);

  const linesGeo = useMemo((): FeatureCollection<Geometry> => ({
    type: 'FeatureCollection',
    features: segments.map((s) => ({
      type: 'Feature' as const,
      properties: { mode: s.mode },
      geometry: { type: 'LineString' as const, coordinates: s.coordinates },
    })),
  }), [segments]);

  const colors = mapThemeDark ? MODE_COLORS_DARK : MODE_COLORS_LIGHT;
  const lineColor = mapThemeDark ? 'rgba(130, 190, 255, 0.55)' : 'rgba(36, 92, 158, 0.45)';
  const now = typeof performance !== 'undefined' ? performance.now() : 0;

  if (segments.length === 0) return null;

  return (
    <>
      <Source id={SOURCE_USER_ROUTES} type='geojson' data={linesGeo}>
        <Layer
          id={LAYER_USER_ROUTES_LINE}
          type='line'
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': lineColor, 'line-width': 1.35, 'line-opacity': 0.42 }}
        />
      </Source>
      {!reducedMotion && segments.map((seg) => (
        <VehicleMarker key={seg.id} seg={seg} color={colors[seg.mode]} now={now} />
      ))}
    </>
  );
}
