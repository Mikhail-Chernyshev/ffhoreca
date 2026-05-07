import type { Geometry, MultiPolygon, Polygon, Position } from 'geojson';

/**
 * Порог разницы между соседними долготами, при котором считаем переход "прыжком
 * через датолинию" (±360°).  Фиджи и Россия хранят граничные рёбра вдоль ±180°
 * как два таких прыжка в начале и конце кольца.
 */
const DATELINE_JUMP_THRESHOLD = 340;

/** Полигоны с охватом по долготе выше порога ломают triangulation в MapLibre. */
const MAX_OUTER_RING_LNG_SPAN = 180.02;

/**
 * После первичной обработки иногда остаются «щели» с одним ребром ~180° по долготе.
 * Реальные границы в world-atlas редко прыгают > ~120° между соседними вершинами.
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
    const d = Math.abs((ring[i + 1]![0] as number) - (ring[i]![0] as number));
    if (d > m) m = d;
  }
  const a = ring[0]![0] as number;
  const b = ring[ring.length - 1]![0] as number;
  return Math.max(m, Math.abs(a - b));
}

function ringMaxLatitude(ring: Position[]): number {
  let max = -90;
  for (const p of ring) max = Math.max(max, p[1] as number);
  return max;
}

/**
 * Исправляет кольца, у которых граница полигона проходит ПО датолинии (±180°).
 * world-atlas хранит такие кольца с двумя «прыжками» ~360° в начале и конце:
 *   [..., (-180, lat_a), (+179.9, lat_b), ... береговая линия ..., (+179.8, lat_c), (-180, lat_d), ...]
 *
 * Стратегия:
 *  1. Найти индексы двух прыжков j1 и j2.
 *  2. «Береговая линия» — вершины от j1+1 до j2 включительно.
 *  3. Закрыть кольцо двумя точками вдоль ±180°, убрав прыжки полностью.
 *
 * Возвращает null, если паттерн не совпадает (не ровно 2 прыжка).
 */
function fixDatelineBoundaryRing(ring: Position[]): Position[] | null {
  const jumps: number[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const d = Math.abs((ring[i + 1]![0] as number) - (ring[i]![0] as number));
    if (d > DATELINE_JUMP_THRESHOLD) jumps.push(i);
  }
  if (jumps.length !== 2) return null;

  const [j1, j2] = jumps as [number, number];

  // Береговая линия: от j1+1 до j2 (включительно)
  const firstCoastLng = ring[j1 + 1]![0] as number;
  const closureLng = firstCoastLng >= 0 ? 180 : -180;

  const result: Position[] = [];
  for (let i = j1 + 1; i <= j2; i++) {
    result.push(ring[i]!);
  }

  // Замыкаем вдоль датолинии (два явных угла у ±180°)
  result.push([closureLng, ring[j2]![1] as number]);
  result.push([closureLng, ring[j1 + 1]![1] as number]);
  result.push(ring[j1 + 1]!); // close ring

  return result;
}

function splitPolygonRingsIfNeeded(rings: Position[][]): Position[][][] {
  const outer = rings[0];
  if (!outer?.length) return [rings];
  if (ringLngSpan(outer) <= 180) return [rings];

  // Полярные кольца Антарктики — не трогаем (они и так отфильтруются по span).
  if (ringMaxLatitude(outer) <= -55) return [];

  const fixedOuter = fixDatelineBoundaryRing(outer);
  if (fixedOuter == null) return []; // неизвестный паттерн — пропустить

  const fixedInners = rings.slice(1).map((r) => {
    if (ringLngSpan(r) > DATELINE_JUMP_THRESHOLD) {
      return fixDatelineBoundaryRing(r) ?? r;
    }
    return r;
  });

  return [[fixedOuter, ...fixedInners]];
}

function fixPolygon(geom: Polygon): Polygon | MultiPolygon {
  if (ringLngSpan(geom.coordinates[0] ?? []) <= 180) return geom;
  const parts = splitPolygonRingsIfNeeded(geom.coordinates);
  if (parts.length === 0) return geom; // fallback: вернуть как есть
  if (parts.length === 1) return { type: 'Polygon', coordinates: parts[0] };
  return { type: 'MultiPolygon', coordinates: parts };
}

function fixMultiPolygon(geom: MultiPolygon): MultiPolygon {
  const nextCoords: Position[][][] = [];
  for (const polygon of geom.coordinates) {
    if (ringLngSpan(polygon[0] ?? []) <= 180) {
      nextCoords.push(polygon);
    } else {
      const parts = splitPolygonRingsIfNeeded(polygon);
      nextCoords.push(...parts);
    }
  }
  return { type: 'MultiPolygon', coordinates: nextCoords };
}

/** Починка геометрии для заливки в MapLibre (Россия, Фиджи и т.д.). */
export function fixGeojsonAntimeridian(geom: Geometry): Geometry {
  if (geom.type === 'Polygon') return fixPolygon(geom);
  if (geom.type === 'MultiPolygon') return fixMultiPolygon(geom);
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
