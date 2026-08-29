// A "mode" is just a metric applied to the split. Area today; population,
// GDP, number of cities, etc. plug in here without touching the engine.

import type { Feature } from "geojson";
import { areaSplit } from "./engine";
import type { Position } from "./geo";

export interface ModeResult {
  /** share of the metric on side A, in [0, 1] */
  fractionA: number;
  valueA: number;
  valueB: number;
  unit: string;
}

export interface Mode {
  id: string;
  label: string;
  evaluate(country: Feature, a: Position, b: Position): ModeResult;
}

export const areaMode: Mode = {
  id: "area",
  label: "Área",
  evaluate(country, a, b) {
    const r = areaSplit(country, a, b);
    return {
      fractionA: r.fractionA,
      valueA: r.areaA / 1e6, // m² -> km²
      valueB: r.areaB / 1e6,
      unit: "km2",
    };
  },
};

// Population mode lands here once per-country population grids are built
// (see scripts/build-population.ts on the roadmap).

export const modes: Record<string, Mode> = {
  [areaMode.id]: areaMode,
};
