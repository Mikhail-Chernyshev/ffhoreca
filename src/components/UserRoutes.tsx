import { useEffect, useMemo, useReducer, useState, useSyncExternalStore } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { FeatureCollection, Geometry } from 'geojson';
import type { TravelRoute, UserRouteMode } from '../data/types';
import { greatCircleArc, type LngLatDeg } from '../lib/greatCircle';
import { fetchOsrmRoadRoute, usesRoadRouting } from '../lib/osrmRoute';
import { positionAndBearingOneWayOnArc } from '../lib/travelStoryRoutes';
import { RouteModeIcon } from './RouteModeIcon';

const SOURCE_USER_ROUTES = 'user-routes';
const LAYER_USER_ROUTES_LINE = 'user-routes-line';
const PLANE_VISUAL_SPEED_KMH = 900;
const SPEED_RATIO: Record<UserRouteMode, number> = {
  plane: 3.5,
  train: 0.25,
  bus:   0.28,
  boat:  0.12,
  car:   0.33,
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

const MODE_COLORS_DARK: Record<UserRouteMode, string> = {
  plane: '#a8d4ff',
  train: '#cbd5e1',
  bus:   '#ffd599',
  boat:  '#67e8f9',
  car:   '#c4b5fd',
};

const MODE_COLORS_LIGHT: Record<UserRouteMode, string> = {
  plane: '#1e4d8c',
  train: '#475569',
  bus:   '#b45309',
  boat:  '#0e7490',
  car:   '#6d28d9',
};

type SegmentDef = {
  id: string;
  mode: UserRouteMode;
  fromLng: number;
  fromLat: number;
  toLng: number;
  toLat: number;
};

type AnimSegment = {
  id: string;
  mode: UserRouteMode;
  coordinates: LngLatDeg[];
  cycleDurationMs: number;
};

function arcForSegment(def: SegmentDef): LngLatDeg[] {
  return greatCircleArc(def.fromLng, def.fromLat, def.toLng, def.toLat, 56);
}

function segmentFromDef(def: SegmentDef, coordinates: LngLatDeg[]): AnimSegment {
  return {
    id: def.id,
    mode: def.mode,
    coordinates,
    cycleDurationMs: cycleDurationMs(polylineLengthKm(coordinates), def.mode),
  };
}

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
        <RouteModeIcon mode={seg.mode} size={17} />
      </span>
    </Marker>
  );
}

type Props = {
  routes: TravelRoute[];
  mapThemeDark: boolean;
};

export function UserRoutes({ routes, mapThemeDark }: Props) {
  const segmentDefs = useMemo((): SegmentDef[] => {
    const result: SegmentDef[] = [];
    for (const route of routes) {
      for (let i = 0; i < route.waypoints.length - 1; i++) {
        const from = route.waypoints[i]!;
        const to = route.waypoints[i + 1]!;
        result.push({
          id: `${route.id}-${i}`,
          mode: route.mode,
          fromLng: from.lng,
          fromLat: from.lat,
          toLng: to.lng,
          toLat: to.lat,
        });
      }
    }
    return result;
  }, [routes]);

  const [roadCoordsById, setRoadCoordsById] = useState<Record<string, LngLatDeg[]>>({});
  const [roadFailedIds, setRoadFailedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    setRoadCoordsById({});
    setRoadFailedIds(new Set());

    const roadDefs = segmentDefs.filter((d) => usesRoadRouting(d.mode));
    if (roadDefs.length === 0) return () => { cancelled = true; };

    void (async () => {
      for (const def of roadDefs) {
        if (cancelled) return;
        try {
          const line = await fetchOsrmRoadRoute(
            def.fromLng,
            def.fromLat,
            def.toLng,
            def.toLat,
            def.mode,
          );
          if (cancelled) return;
          if (!line) {
            setRoadFailedIds((prev) => new Set(prev).add(def.id));
            continue;
          }
          setRoadCoordsById((prev) => ({ ...prev, [def.id]: line }));
        } catch {
          if (!cancelled) {
            setRoadFailedIds((prev) => new Set(prev).add(def.id));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [segmentDefs]);

  const segments = useMemo((): AnimSegment[] => {
    const result: AnimSegment[] = [];
    for (const def of segmentDefs) {
      if (usesRoadRouting(def.mode)) {
        const road = roadCoordsById[def.id];
        if (road) {
          result.push(segmentFromDef(def, road));
        } else if (roadFailedIds.has(def.id)) {
          result.push(segmentFromDef(def, arcForSegment(def)));
        }
        continue;
      }
      result.push(segmentFromDef(def, arcForSegment(def)));
    }
    return result;
  }, [segmentDefs, roadCoordsById, roadFailedIds]);

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
  const lineColor = mapThemeDark ? 'rgba(251, 113, 133, 0.82)' : 'rgba(219, 39, 119, 0.72)';
  const now = typeof performance !== 'undefined' ? performance.now() : 0;

  if (segments.length === 0) return null;

  return (
    <>
      <Source id={SOURCE_USER_ROUTES} type='geojson' data={linesGeo}>
        <Layer
          id={LAYER_USER_ROUTES_LINE}
          type='line'
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': lineColor, 'line-width': 1.5, 'line-opacity': 0.58 }}
        />
      </Source>
      {!reducedMotion && segments.map((seg) => (
        <VehicleMarker key={seg.id} seg={seg} color={colors[seg.mode]} now={now} />
      ))}
    </>
  );
}
