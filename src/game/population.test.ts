import { describe, expect, it } from "vitest";
import type { Feature } from "geojson";
import { createPopulationMode, type PopulationField } from "./population";

const country: Feature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
  },
};

const field: PopulationField = {
  id: "TST",
  total: 100,
  cities: [
    [2, 5, 70], // west
    [8, 5, 30], // east
  ],
};

describe("createPopulationMode", () => {
  it("splits by which side of the line each city falls on", () => {
    const mode = createPopulationMode(field);
    // vertical line at x=5 pointing north -> west is side A
    const r = mode.evaluate(country, [5, -5], [5, 15]);
    expect(r.fractionA).toBeCloseTo(0.7);
    expect(r.valueA).toBe(70);
    expect(r.valueB).toBe(30);
    expect(r.unit).toBe("hab.");
  });

  it("puts everyone on one side when the line clears all cities", () => {
    const mode = createPopulationMode(field);
    const r = mode.evaluate(country, [50, -5], [50, 15]);
    expect(Math.max(r.fractionA, 1 - r.fractionA)).toBe(1);
  });

  it("derives the total from the cities when not given", () => {
    const mode = createPopulationMode({ id: "X", total: 0, cities: field.cities });
    const r = mode.evaluate(country, [5, -5], [5, 15]);
    expect(r.fractionA).toBeCloseTo(0.7);
  });
});
