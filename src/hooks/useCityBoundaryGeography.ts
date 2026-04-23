import { useEffect, useMemo, useState } from 'react';
import { rewindGeoJson } from '../lib/geojsonRewind';
import type { City } from '../data/types';

type GeoFeature = {
  type: 'Feature';
  geometry: object;
  properties?: Record<string, unknown>;
};

type FeatureCollection = {
  type: 'FeatureCollection';
  features: GeoFeature[];
};

const GEOMETRY_TYPES = new Set([
  'Point',
  'LineString',
  'Polygon',
  'MultiPoint',
  'MultiLineString',
  'MultiPolygon',
  'GeometryCollection',
]);

/**
 * Nominatim/OSM часто отдают GeometryCollection или один Polygon без оболочки Feature.
 * react-simple-maps ждёт FeatureCollection с массивом Feature.
 */
function normalizeCityBoundaryJson(raw: unknown): FeatureCollection | null {
  if (raw == null || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const t = g.type;

  if (t === 'FeatureCollection') {
    const features = g.features;
    if (!Array.isArray(features) || features.length === 0) return null;
    const out: GeoFeature[] = [];
    for (const f of features) {
      if (
        f != null &&
        typeof f === 'object' &&
        (f as GeoFeature).type === 'Feature' &&
        (f as GeoFeature).geometry != null
      ) {
        out.push(f as GeoFeature);
      }
    }
    return out.length > 0 ? { type: 'FeatureCollection', features: out } : null;
  }

  if (t === 'Feature' && g.geometry != null) {
    return { type: 'FeatureCollection', features: [g as GeoFeature] };
  }

  if (t === 'GeometryCollection' && Array.isArray(g.geometries)) {
    const out: GeoFeature[] = [];
    for (const geom of g.geometries) {
      if (geom != null && typeof geom === 'object' && 'type' in geom) {
        const gt = (geom as { type: string }).type;
        if (
          gt === 'GeometryCollection' &&
          Array.isArray((geom as { geometries?: unknown }).geometries)
        ) {
          const nested = normalizeCityBoundaryJson({
            type: 'GeometryCollection',
            geometries: (geom as { geometries: object[] }).geometries,
          });
          if (nested) out.push(...nested.features);
        } else if (GEOMETRY_TYPES.has(gt) && gt !== 'GeometryCollection') {
          out.push({
            type: 'Feature',
            properties: {},
            geometry: geom as object,
          });
        }
      }
    }
    return out.length > 0 ? { type: 'FeatureCollection', features: out } : null;
  }

  if (
    typeof t === 'string' &&
    GEOMETRY_TYPES.has(t) &&
    t !== 'GeometryCollection'
  ) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: g as object }],
    };
  }

  return null;
}

/** Загружает GeoJSON границ из public/geo/cities/{id}.json и склеивает в один слой. */
export function useCityBoundaryGeography(cities: City[]): {
  geography: FeatureCollection | null;
  boundaryCityIds: Set<string>;
} {
  const [geography, setGeography] = useState<FeatureCollection | null>(null);
  const [boundaryCityIds, setBoundaryCityIds] = useState<Set<string>>(
    () => new Set(),
  );

  const cityIds = useMemo(() => cities.map((c) => c.id).join('|'), [cities]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const loadedIds = new Set<string>();
      const allFeatures: FeatureCollection['features'] = [];

      await Promise.all(
        cities.map(async (c) => {
          try {
            const base = import.meta.env.BASE_URL.replace(/\/$/, '');
            const res = await fetch(
              `${base}/geo/cities/${encodeURIComponent(c.id)}.json`,
            );
            if (!res.ok) return;
            const gj = normalizeCityBoundaryJson(await res.json());
            if (!gj?.features?.length) return;
            rewindGeoJson(gj, true);
            loadedIds.add(c.id);
            for (const f of gj.features) {
              allFeatures.push({
                ...f,
                properties: { ...f.properties, _cityId: c.id },
              });
            }
          } catch {
            /* нет файла */
          }
        }),
      );

      if (cancelled) return;

      setBoundaryCityIds(loadedIds);
      if (allFeatures.length > 0) {
        setGeography({ type: 'FeatureCollection', features: allFeatures });
      } else {
        setGeography(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cityIds, cities]);

  return { geography, boundaryCityIds };
}
