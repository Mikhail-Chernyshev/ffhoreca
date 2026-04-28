/** Точка [lng, lat] в градусах (GeoJSON). */
export type LngLatDeg = [number, number];

/**
 * Дискретизация дуги большого круга между двумя точками на сфере.
 * Координаты равномерны по углу — для отрисовки «рейсов» на карте.
 */
export function greatCircleArc(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  segments = 56,
): LngLatDeg[] {
  const coords: LngLatDeg[] = [];
  const φ1 = (fromLat * Math.PI) / 180;
  const λ1 = (fromLng * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const λ2 = (toLng * Math.PI) / 180;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinφ2 = Math.sin(φ2);
  const cosφ2 = Math.cos(φ2);
  const cosδ = sinφ1 * sinφ2 + cosφ1 * cosφ2 * Math.cos(λ2 - λ1);
  const δ = Math.acos(Math.min(1, Math.max(-1, cosδ)));

  if (!Number.isFinite(δ) || δ < 1e-8) {
    return [[fromLng, fromLat]];
  }

  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * δ) / Math.sin(δ);
    const B = Math.sin(f * δ) / Math.sin(δ);
    const x = A * cosφ1 * Math.cos(λ1) + B * cosφ2 * Math.cos(λ2);
    const y = A * cosφ1 * Math.sin(λ1) + B * cosφ2 * Math.sin(λ2);
    const z = A * sinφ1 + B * sinφ2;
    const φi = Math.atan2(z, Math.sqrt(x * x + y * y));
    const λi = Math.atan2(y, x);
    coords.push([(λi * 180) / Math.PI, (φi * 180) / Math.PI]);
  }
  return coords;
}

/** Азимут от точки A к B в градусах (0° = север), для поворота маркера. */
export function bearingDegrees(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
): number {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/** Расстояние по поверхности сферы, км (для отсечения «слишком коротких» перелётов). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
