import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';
import { Layer, Marker, Source } from 'react-map-gl/maplibre';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Catalog } from '../data/types';
import {
  buildRoutesToSaintPetersburg,
  positionAndBearingRoundTripOnArc,
} from '../lib/flightsToSaintPetersburg';

export const SOURCE_FLIGHT_ARCS = 'flight-arcs';
export const LAYER_FLIGHT_ARCS_LINE = 'flight-arcs-line';

/** На «районном» зуме линии перегружают карту — только обзор. */
const FLIGHT_ANIM_MAX_ZOOM = 8.85;

const LOOP_MS = 52000;

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

export function FlightRoutesToSpb({ catalog, zoom, mapThemeDark }: Props) {
  const routes = useMemo(
    () => buildRoutesToSaintPetersburg(catalog),
    [catalog],
  );

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );

  const [, forcePlanesTick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (reducedMotion) return;
    if (routes.length === 0) return;
    if (zoom > FLIGHT_ANIM_MAX_ZOOM) return;

    let id = 0;
    const loop = () => {
      forcePlanesTick();
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
        properties: { id: r.originCityId },
        geometry: {
          type: 'LineString' as const,
          coordinates: r.coordinates,
        },
      })),
    };
  }, [routes]);

  const showLayer = zoom <= FLIGHT_ANIM_MAX_ZOOM && routes.length > 0;

  const lineColor = mapThemeDark
    ? 'rgba(130, 190, 255, 0.55)'
    : 'rgba(36, 92, 158, 0.45)';

  const planeColor = mapThemeDark ? '#a8d4ff' : '#1e4d8c';

  const now =
    typeof performance !== 'undefined' ? performance.now() : 0;

  if (!showLayer) return null;

  return (
    <>
      <Source id={SOURCE_FLIGHT_ARCS} type='geojson' data={linesGeo}>
        <Layer
          id={LAYER_FLIGHT_ARCS_LINE}
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
        ? routes.map((route) => {
            const phase = hashPhase(route.originCityId);
            const progress =
              ((now % LOOP_MS) / LOOP_MS + phase) % 1;
            const pos = positionAndBearingRoundTripOnArc(
              route.coordinates,
              progress,
            );
            if (pos == null) return null;
            return (
              <Marker
                key={`flight-${route.originCityId}`}
                longitude={pos.lng}
                latitude={pos.lat}
                anchor='center'
              >
                <span
                  className='world-map-flight-plane'
                  style={{
                    color: planeColor,
                    transform: `rotate(${pos.bearing}deg)`,
                  }}
                  aria-hidden
                >
                  <svg
                    viewBox='0 0 24 24'
                    width={17}
                    height={17}
                    fill='currentColor'
                  >
                    <path d='M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' />
                  </svg>
                </span>
              </Marker>
            );
          })
        : null}
    </>
  );
}
