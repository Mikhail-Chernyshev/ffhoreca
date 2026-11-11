import type { PlaceCategory } from '../data/types';

export type MapMarkerKind = PlaceCategory | 'city';

type Props = {
  kind: MapMarkerKind;
  size?: number;
};

/** Белая пиктограмма внутри цветного маркера. Силуэты читаются на ~11–12px. */
export function MapCategoryGlyph({ kind, size = 12 }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className="map-category-glyph"
    >
      <path fill="currentColor" d={GLYPH_PATH[kind]} />
    </svg>
  );
}

/** Material-подобные силуэты: lodging/food/bar/airport/star/city. */
const GLYPH_PATH: Record<MapMarkerKind, string> = {
  lodging:
    'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z',
  food: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
  bar: 'M21 5V3H3v2l8 9v5H6v2h12v-2h-5v-5l8-9zM7.43 7 5.66 5h12.69l-1.78 2H7.43z',
  airport:
    'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  attraction:
    'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  city: 'M4 21V8.2L9.2 4.5 13.5 8V21H4zm9.5 0V7.2L20 4.8V21h-6.5z',
};
