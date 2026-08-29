// Coarse search for the best straight line, used to reveal "how close to
// perfect was even possible" after a guess. Precompute this offline per
// country later (scripts/build-solutions.ts); fine to run live for now.

import type { Feature } from "geojson";
import { areaSplit, toMultiPolygon } from "./engine";
import { bounds, type Position } from "./geo";

export interface BalancedLine {
  a: Position;
  b: Position;
  fractionA: number;
}

/**
 * Coarse search for the straight line that comes closest to a 50/50 split.
 * `fractionAOf` defaults to area; pass a mode's evaluator for population, etc.
 */
export interface SearchGrid {
  coarseDeg: number;
  coarseOff: number;
  fineDeg: number;
  fineOff: number;
  fineRangeDeg: number;
  fineRangeOff: number;
}

/** Coarse sweep then a fine search around the winner — ~840 evaluations. */
const DEFAULT_GRID: SearchGrid = {
  coarseDeg: 6,
  coarseOff: 0.05,
  fineDeg: 1,
  fineOff: 0.008,
  fineRangeDeg: 6,
  fineRangeOff: 0.06,
};

export function bestBalancedLine(
  country: Feature,
  fractionAOf?: (a: Position, b: Position) => number,
  grid: SearchGrid = DEFAULT_GRID,
): BalancedLine {
  const fractionOf =
    fractionAOf ?? ((a: Position, b: Position) => areaSplit(country, a, b).fractionA);
  const { minX, minY, maxX, maxY } = bounds(toMultiPolygon(country));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY);

  const lineFor = (deg: number, offset: number): { a: Position; b: Position } => {
    const t = (deg * Math.PI) / 180;
    const dx = Math.cos(t);
    const dy = Math.sin(t);
    const ox = cx + -dy * offset * span; // sweep sideways along the normal
    const oy = cy + dx * offset * span;
    return {
      a: [ox - dx * span, oy - dy * span],
      b: [ox + dx * span, oy + dy * span],
    };
  };

  let best = { deg: 0, offset: 0, err: Infinity };
  const consider = (deg: number, offset: number): void => {
    const { a, b } = lineFor(deg, offset);
    const err = Math.abs(fractionOf(a, b) - 0.5);
    if (err < best.err) best = { deg, offset, err };
  };

  // two passes: a coarse sweep, then a fine search around the winner
  for (let deg = 0; deg < 180; deg += grid.coarseDeg) {
    for (let offset = -0.5; offset <= 0.5 + 1e-9; offset += grid.coarseOff) {
      consider(deg, offset);
    }
  }
  const { deg: d0, offset: o0 } = best;
  for (let deg = d0 - grid.fineRangeDeg; deg <= d0 + grid.fineRangeDeg + 1e-9; deg += grid.fineDeg) {
    for (let offset = o0 - grid.fineRangeOff; offset <= o0 + grid.fineRangeOff + 1e-9; offset += grid.fineOff) {
      consider(deg, offset);
    }
  }

  const { a, b } = lineFor(best.deg, best.offset);
  return { a, b, fractionA: fractionOf(a, b) };
}
