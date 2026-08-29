// Pure geometry helpers. No DOM, no rendering — safe to run in tests or a Worker.

export type Position = [number, number];
export type Ring = Position[];
/** [outerRing, ...holeRings] */
export type PolygonCoords = Ring[];
export type MultiPolygonCoords = PolygonCoords[];

const EARTH_RADIUS = 6378137; // metres (WGS84 equatorial), matches @turf/area

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Geodesic area of a linear ring in square metres (signed by winding order).
 * Same algorithm as @turf/area, which is Chamberlain & Duquette's method.
 */
export function ringArea(ring: Ring): number {
  const n = ring.length;
  if (n < 3) return 0;

  let total = 0;
  for (let i = 0; i < n; i++) {
    const lower = ring[i]!;
    const middle = ring[(i + 1) % n]!;
    const upper = ring[(i + 2) % n]!;
    total += (toRad(upper[0]) - toRad(lower[0])) * Math.sin(toRad(middle[1]));
  }
  return (total * EARTH_RADIUS * EARTH_RADIUS) / 2;
}

/** Area of one polygon (outer ring minus holes), always >= 0. */
export function polygonArea(polygon: PolygonCoords): number {
  if (polygon.length === 0) return 0;
  let area = Math.abs(ringArea(polygon[0]!));
  for (let i = 1; i < polygon.length; i++) {
    area -= Math.abs(ringArea(polygon[i]!));
  }
  return Math.max(area, 0);
}

/** Total area of a multipolygon in square metres. */
export function multiPolygonArea(multiPolygon: MultiPolygonCoords): number {
  let total = 0;
  for (const polygon of multiPolygon) total += polygonArea(polygon);
  return total;
}

/**
 * Signed position of point `p` relative to the ray a->b:
 * > 0 on the left (side A, drawn COLOR_A), < 0 on the right, 0 on the line.
 * Matches how `splitByLine` assigns sideA.
 */
export function sideOfLine(a: Position, b: Position, p: Position): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

export function bounds(multiPolygon: MultiPolygonCoords): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}
