// Population mode: split the country so that equal numbers of people fall on
// each side of the line. "People" here = Natural Earth city populations — a
// coarse proxy, but the shape (weighted points) is the same one a real
// gridded dataset would produce, so the mode never has to change.

import type { Feature } from "geojson";
import { sideOfLine, type Position } from "./geo";
import type { Mode, ModeResult } from "./modes";

export interface PopulationField {
  id: string;
  total: number;
  /** [lng, lat, population], sorted by population desc */
  cities: Array<[number, number, number]>;
}

export function createPopulationMode(field: PopulationField): Mode {
  const total =
    field.total || field.cities.reduce((sum, city) => sum + city[2], 0);

  return {
    id: "population",
    label: "População",
    evaluate(_country: Feature, a: Position, b: Position): ModeResult {
      let populationA = 0;
      for (const [lng, lat, population] of field.cities) {
        if (sideOfLine(a, b, [lng, lat]) > 0) populationA += population;
      }
      return {
        fractionA: total > 0 ? populationA / total : 0,
        valueA: populationA,
        valueB: Math.max(total - populationA, 0),
        unit: "hab.",
      };
    },
  };
}
