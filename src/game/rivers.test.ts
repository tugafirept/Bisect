import { describe, expect, it } from "vitest";
import type { Feature } from "geojson";
import { createRiverMode, type RiverField } from "./rivers";

const country: Feature = {
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] },
};

// two equal-length horizontal rivers, one in the west half, one in the east
const field: RiverField = {
  id: "TST",
  totalKm: 0,
  rivers: [
    [
      [1, 5],
      [4, 5],
    ],
    [
      [6, 5],
      [9, 5],
    ],
  ],
};

describe("createRiverMode", () => {
  it("splits river length by which side of the line each segment's midpoint falls", () => {
    const mode = createRiverMode(field);
    // vertical line at x=5 pointing north -> west is side A
    const r = mode.evaluate(country, [5, -5], [5, 15]);
    expect(r.fractionA).toBeCloseTo(0.5, 2);
    expect(r.unit).toBe("km de rio");
    expect(r.valueA + r.valueB).toBeGreaterThan(0);
  });

  it("puts all river length on one side when the line clears the country", () => {
    const mode = createRiverMode(field);
    const r = mode.evaluate(country, [50, -5], [50, 15]);
    expect(Math.max(r.fractionA, 1 - r.fractionA)).toBe(1);
  });

  it("weights by length, not by number of rivers", () => {
    const lopsided: RiverField = {
      id: "X",
      totalKm: 0,
      rivers: [
        [
          [1, 5],
          [1, 9],
        ], // long, west
        [
          [8, 5],
          [8, 5.5],
        ], // short, east
      ],
    };
    const r = createRiverMode(lopsided).evaluate(country, [5, -5], [5, 15]);
    expect(r.fractionA).toBeGreaterThan(0.8);
  });
});
