// The core, framework-agnostic game engine:
//   given a country polygon + an infinite straight line, return the two halves
//   and how the area divides between them.

import polygonClipping from "polygon-clipping";
import type { Feature, Geometry } from "geojson";
import {
  bounds,
  multiPolygonArea,
  type MultiPolygonCoords,
  type Position,
  type Ring,
} from "./geo";
import { rewindMultiPolygon } from "./rewind";

export interface SplitResult {
  /** Part of the country on the left of a→b (empty array if none). */
  sideA: MultiPolygonCoords;
  /** Part of the country on the right of a→b. */
  sideB: MultiPolygonCoords;
}

export interface AreaSplit extends SplitResult {
  /** square metres */
  areaA: number;
  areaB: number;
  total: number;
  /** areaA / total, in [0, 1] */
  fractionA: number;
}

export function geometryOf(input: Feature | Geometry): Geometry {
  return "type" in input && input.type === "Feature"
    ? (input.geometry as Geometry)
    : (input as Geometry);
}

/** Normalise a Polygon / MultiPolygon geometry to MultiPolygon coordinates. */
export function toMultiPolygon(input: Feature | Geometry): MultiPolygonCoords {
  const geom = geometryOf(input);
  if (geom.type === "Polygon") return [geom.coordinates as Ring[]];
  if (geom.type === "MultiPolygon") return geom.coordinates as MultiPolygonCoords;
  throw new Error(`Unsupported geometry type: ${geom.type}`);
}

/**
 * A big quadrilateral covering one half-plane of the infinite line through a→b.
 * `side` = +1 (left) or -1 (right), by the sign of the 2D cross product.
 * `reach` must comfortably exceed the country's extent.
 */
function halfPlane(a: Position, b: Position, side: 1 | -1, reach: number): Ring {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // unit perpendicular pointing to the chosen side
  const nx = -uy * side;
  const ny = ux * side;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const p1: Position = [mx - ux * reach, my - uy * reach];
  const p2: Position = [mx + ux * reach, my + uy * reach];
  const p3: Position = [p2[0] + nx * reach, p2[1] + ny * reach];
  const p4: Position = [p1[0] + nx * reach, p1[1] + ny * reach];
  return [p1, p2, p3, p4, p1];
}

/** Split a country by the infinite line through points a and b (lng/lat). */
export function splitByLine(
  input: Feature | Geometry,
  a: Position,
  b: Position,
): SplitResult {
  const country = toMultiPolygon(input);
  const { minX, minY, maxX, maxY } = bounds(country);
  const reach = (Math.max(maxX - minX, maxY - minY) + 1) * 8;

  const sideA = polygonClipping.intersection(
    country as GeomInput,
    [halfPlane(a, b, 1, reach)] as GeomInput,
  );
  const sideB = polygonClipping.intersection(
    country as GeomInput,
    [halfPlane(a, b, -1, reach)] as GeomInput,
  );

  return {
    // rewind so the halves render the right way up in d3-geo too
    sideA: rewindMultiPolygon(sideA as MultiPolygonCoords),
    sideB: rewindMultiPolygon(sideB as MultiPolygonCoords),
  };
}

/** Split a country and measure how the area divides. */
export function areaSplit(
  input: Feature | Geometry,
  a: Position,
  b: Position,
): AreaSplit {
  const { sideA, sideB } = splitByLine(input, a, b);
  const areaA = multiPolygonArea(sideA);
  const areaB = multiPolygonArea(sideB);
  const total = areaA + areaB;
  return {
    sideA,
    sideB,
    areaA,
    areaB,
    total,
    fractionA: total > 0 ? areaA / total : 0,
  };
}

// polygon-clipping's exported types are loose; this alias documents intent.
type GeomInput = Parameters<typeof polygonClipping.intersection>[0];
