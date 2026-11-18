import type { ReactNode } from 'react';
import type { PlaceCategory } from '../data/types';

export type MapMarkerKind = PlaceCategory | 'city';

type Props = {
  kind: MapMarkerKind;
  size?: number;
};

/** Крупный силуэт внутри маркера: читается на 13–15px. */
export function MapCategoryGlyph({ kind, size = 14 }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className="map-category-glyph"
    >
      {GLYPH[kind]}
    </svg>
  );
}

const fill = { fill: 'currentColor' };

const GLYPH: Record<MapMarkerKind, ReactNode> = {
  lodging: (
    <>
      <rect x="4.2" y="7.2" width="9.2" height="5.4" rx="2.2" {...fill} />
      <rect x="2.8" y="12.2" width="18.4" height="7.2" rx="1.4" {...fill} />
      <rect x="2.2" y="19.2" width="19.6" height="2.1" rx="0.8" {...fill} />
    </>
  ),
  food: (
    <>
      <rect x="4.1" y="2.4" width="2" height="7.4" rx="1" {...fill} />
      <rect x="7" y="2.4" width="2" height="7.4" rx="1" {...fill} />
      <rect x="9.9" y="2.4" width="2" height="7.4" rx="1" {...fill} />
      <rect x="7" y="8.6" width="2" height="13" rx="1" {...fill} />
      <rect x="14.6" y="2.4" width="3.6" height="10.2" rx="1.5" {...fill} />
      <rect x="15.6" y="11.4" width="1.7" height="10.2" rx="0.85" {...fill} />
    </>
  ),
  bar: (
    <>
      <polygon points="4.4,3.4 19.6,3.4 12,14.2" {...fill} />
      <rect x="11.05" y="13.4" width="1.9" height="5.8" rx="0.8" {...fill} />
      <rect x="7.4" y="19" width="9.2" height="2" rx="1" {...fill} />
    </>
  ),
  airport: (
    <path
      {...fill}
      d="M21 15.6v-2.1l-8.1-5V4.2A1.6 1.6 0 0 0 11.3 2.6 1.6 1.6 0 0 0 9.7 4.2v4.3L1.6 13.5v2.1l8.1-2.4v5.1l-2.1 1.6v1.6l3.7-1 3.7 1v-1.6l-2.1-1.6v-5.1l8.1 2.4z"
    />
  ),
  attraction: (
    <>
      <rect x="8.2" y="4.6" width="7.6" height="3.2" rx="1.1" {...fill} />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M5.4 7.8c-1.1 0-2 0.9-2 2v8.4c0 1.1.9 2 2 2h13.2c1.1 0 2-.9 2-2V9.8c0-1.1-.9-2-2-2H5.4Zm6.6 3.1a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z"
      />
    </>
  ),
  city: (
    <>
      <rect x="2.6" y="10" width="8.4" height="11.6" rx="1" {...fill} />
      <polygon points="2.6,10 6.8,5.2 11,10" {...fill} />
      <rect x="12.8" y="7.2" width="8.6" height="14.4" rx="1" {...fill} />
      <polygon points="12.8,7.2 17.1,2.8 21.4,7.2" {...fill} />
    </>
  ),
};
