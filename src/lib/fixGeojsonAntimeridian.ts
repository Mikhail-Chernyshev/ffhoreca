import * as polygonClipping from 'polygon-clipping';
import type {
  MultiPolygon as ClipMultiPolygon,
  Polygon as ClipPolygon,
} from 'polygon-clipping';
import type { Geometry, MultiPolygon, Polygon, Position } from 'geojson';

/**
 * Две полусферы по нулевому меридиану, с микрозазором ±ε у 0°.
 * Иначе прямоугольник [-150,180] даёт ширину 330° — после клипа у части России
 * остаётся охват >180° и MapLibre снова «тянет» треугольники через весь мир.
 * Hemispheres шириной (180−2ε) гарантируют span < 180 у каждого фрагмента.
 */
const EPS = 1e-4;

const WEST_HEMI: ClipMultiPolygon = [
  [[[-180, -90], [-EPS, -90], [-EPS, 90], [-180, 90], [-180, -90]]],
];
const EAST_HEMI: ClipMultiPolygon = [
  [[[EPS, -90], [180, -90], [180, 90], [EPS, 90], [EPS, -90]]],
];

/** Полигоны с охватом по долготе выше порога ломают triangulation в MapLibre (Антарктика у полюса, редкие куски). */
const MAX_OUTER_RING_LNG_SPAN = 180.02;

/**
 * После intersection с полусферами иногда остаются «щели» с одним ребром ~180° по долготе
 * (earcut тянет заливку через весь мир). Реальные границы в world-atlas редко прыгают > ~120°
 * между соседними вершинами.
 */
const MAX_CONSECUTIVE_LNG_DELTA = 165;

export function ringLngSpan(ring: Position[]): number {
  let min = Infinity;
  let max = -Infinity;
  for (const p of ring) {
    const x = p[0] as number;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return max - min;
}

function maxConsecutiveLngDelta(ring: Position[]): number {
  if (ring.length < 2) return 0;
  let m = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const d = Math.abs((ring[i + 1][0] as number) - (ring[i][0] as number));
    if (d > m) m = d;
  }
  const a = ring[0][0] as number;
  const b = ring[ring.length - 1][0] as number;
  return Math.max(m, Math.abs(a - b));
}

function ringMaxLatitude(ring: Position[]): number {
  let max = -90;
  for (const p of ring) {
    max = Math.max(max, p[1] as number);
  }
  return max;
}

function polygonWrapsDateline(rings: Position[][]): boolean {
  const outer = rings[0];
  if (!outer?.length) return false;
  return ringLngSpan(outer) > 180;
}

/**
 * Полярные кольца Антарктики (охват 360° у южного полюса) — не режем.
 */
function shouldSplitWrappedPolygon(rings: Position[][]): boolean {
  if (!polygonWrapsDateline(rings)) return false;
  const outer = rings[0];
  if (!outer?.length) return false;
  return ringMaxLatitude(outer) > -55;
}

function splitPolygonRingsIfNeeded(
  rings: Position[][],
): Position[][][] {
  if (!shouldSplitWrappedPolygon(rings)) {
    return [rings];
  }
  const subject: ClipMultiPolygon = [rings as ClipPolygon];
  const west = polygonClipping.intersection(subject, WEST_HEMI);
  const east = polygonClipping.intersection(subject, EAST_HEMI);
  const out: Position[][][] = [];
  if (west.length) out.push(...west);
  if (east.length) out.push(...east);
  return out.length > 0 ? out : [rings];
}

function fixPolygon(geom: Polygon): Polygon | MultiPolygon {
  if (!shouldSplitWrappedPolygon(geom.coordinates)) {
    return geom;
  }
  const parts = splitPolygonRingsIfNeeded(geom.coordinates);
  if (parts.length === 1) {
    return { type: 'Polygon', coordinates: parts[0] };
  }
  return { type: 'MultiPolygon', coordinates: parts };
}

function fixMultiPolygon(geom: MultiPolygon): MultiPolygon {
  const nextCoords: Position[][][] = [];
  for (const polygon of geom.coordinates) {
    nextCoords.push(...splitPolygonRingsIfNeeded(polygon));
  }
  return { type: 'MultiPolygon', coordinates: nextCoords };
}

/** Починка геометрии для заливки в MapLibre (Россия, Фиджи и т.д.). */
export function fixGeojsonAntimeridian(geom: Geometry): Geometry {
  if (geom.type === 'Polygon') {
    return fixPolygon(geom);
  }
  if (geom.type === 'MultiPolygon') {
    return fixMultiPolygon(geom);
  }
  return geom;
}

/**
 * Убирает полигоны с «полярным» охватом по долготе (>180°): иначе MapLibre рисует
 * треугольники через весь мир (часто принимают за «полосу» у посещённых стран).
 */
export function sanitizeMapFillGeometry(geom: Geometry): Geometry | null {
  if (geom.type === 'Polygon') {
    const outer = geom.coordinates[0];
    if (!outer?.length) return null;
    if (ringLngSpan(outer) > MAX_OUTER_RING_LNG_SPAN) return null;
    if (maxConsecutiveLngDelta(outer) > MAX_CONSECUTIVE_LNG_DELTA) return null;
    return geom;
  }
  if (geom.type === 'MultiPolygon') {
    const kept = geom.coordinates.filter((poly) => {
      const outer = poly[0];
      if (!outer?.length) return false;
      if (ringLngSpan(outer) > MAX_OUTER_RING_LNG_SPAN) return false;
      return maxConsecutiveLngDelta(outer) <= MAX_CONSECUTIVE_LNG_DELTA;
    });
    if (kept.length === 0) return null;
    if (kept.length === geom.coordinates.length) return geom;
    return { type: 'MultiPolygon', coordinates: kept };
  }
  return geom;
}
