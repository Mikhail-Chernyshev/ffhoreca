import rewind from '@mapbox/geojson-rewind'

/**
 * Приводит обход колец полигонов к ожидаемому направлению (для корректной заливки в SVG / d3).
 * Мутирует объект на месте.
 */
export function rewindGeoJson(geojson: { type: string }, outer: boolean): void {
  rewind(geojson, outer)
}
