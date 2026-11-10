import type { LineLayerSpecification } from 'maplibre-gl';

type LinePaint = NonNullable<LineLayerSpecification['paint']>;

/** Cream casing + terracotta core so routes stay readable on flag fills. */
export function routeLineCasingPaint(dark: boolean): LinePaint {
  return {
    'line-color': dark ? 'rgba(18, 16, 14, 0.9)' : 'rgba(255, 248, 242, 0.96)',
    'line-width': 4.2,
    'line-opacity': 1,
  };
}

export function routeLineCorePaint(dark: boolean): LinePaint {
  return {
    'line-color': dark ? '#f0c4b0' : '#c85a32',
    'line-width': 2,
    'line-opacity': 1,
  };
}
