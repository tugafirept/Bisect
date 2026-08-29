// Rivers mode: split the country so each side holds the same total length of
// river. Rivers follow terrain, not the coast, so this is a genuinely different
// puzzle from area or population.

import type { Feature } from "geojson";
import { sideOfLine, type Position } from "./geo";
import type { Mode, ModeResult } from "./modes";

export interface RiverField {
  id: string;
  totalKm: number;
  /** polylines of [lng, lat] vertices */
  rivers: Position[][];
}

const EARTH_R = 6371008.8;
const rad = (d: number): number => (d * Math.PI) / 180;

function segMetres(a: Position, b: Position): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export function createRiverMode(field: RiverField): Mode {
  // sum from the segments so per-side lengths add back to the total exactly
  let total = 0;
  for (const line of field.rivers) {
    for (let i = 0; i < line.length - 1; i++) {
      total += segMetres(line[i]!, line[i + 1]!);
    }
  }

  return {
    id: "rivers",
    label: "Rios",
    evaluate(_country: Feature, a: Position, b: Position): ModeResult {
      let lengthA = 0;
      for (const line of field.rivers) {
        for (let i = 0; i < line.length - 1; i++) {
          const p1 = line[i]!;
          const p2 = line[i + 1]!;
          const mid: Position = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
          if (sideOfLine(a, b, mid) > 0) lengthA += segMetres(p1, p2);
        }
      }
      return {
        fractionA: total > 0 ? lengthA / total : 0,
        valueA: Math.round(lengthA / 1000),
        valueB: Math.round(Math.max(total - lengthA, 0) / 1000),
        unit: "km de rio",
      };
    },
  };
}
