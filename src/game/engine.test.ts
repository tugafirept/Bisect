import { describe, expect, it } from "vitest";
import type { Feature } from "geojson";
import { areaSplit } from "./engine";
import { multiPolygonArea } from "./geo";
import { deviationPercent, score } from "./scoring";
import { bestBalancedLine } from "./optimize";
import prt from "../../public/data/countries/PRT.json";

function square(minX: number, minY: number, size: number): Feature {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [minX, minY],
          [minX + size, minY],
          [minX + size, minY + size],
          [minX, minY + size],
          [minX, minY],
        ],
      ],
    },
  };
}

const sq = square(0, 0, 10);
const fullArea = multiPolygonArea([
  (sq.geometry as unknown as { coordinates: [number, number][][] }).coordinates,
]);

describe("areaSplit", () => {
  it("halves a lon/lat square with a centred meridian", () => {
    const r = areaSplit(sq, [5, -10], [5, 20]);
    expect(r.fractionA).toBeGreaterThan(0.499);
    expect(r.fractionA).toBeLessThan(0.501);
  });

  it("conserves the total area regardless of the cut", () => {
    const r = areaSplit(sq, [3, -10], [7, 20]);
    expect(Math.abs(r.total - fullArea) / fullArea).toBeLessThan(1e-6);
  });

  it("puts everything on one side when the line misses the country", () => {
    const r = areaSplit(sq, [100, -10], [100, 20]);
    expect(Math.max(r.fractionA, 1 - r.fractionA)).toBeGreaterThan(0.999);
  });

  it("keeps fractionA within [0, 1] for a diagonal cut", () => {
    const r = areaSplit(sq, [1, 2], [8, 9]);
    expect(r.fractionA).toBeGreaterThanOrEqual(0);
    expect(r.fractionA).toBeLessThanOrEqual(1);
  });
});

describe("scoring", () => {
  it("is 100 at a perfect split and 0 at a total miss", () => {
    expect(score(0.5)).toBe(100);
    expect(score(1)).toBe(0);
    expect(score(0)).toBe(0);
  });

  it("rewards closer splits more", () => {
    expect(score(0.52)).toBeGreaterThan(score(0.7));
  });

  it("reports deviation in percentage points", () => {
    expect(deviationPercent(0.5)).toBeCloseTo(0);
    expect(deviationPercent(0.65)).toBeCloseTo(15);
  });
});

describe("mainland Portugal", () => {
  const country = prt as unknown as Feature;

  it("has a plausible total area (~89 000 km2 for this coarse outline)", () => {
    const r = areaSplit(country, [-8, 36], [-8, 44]);
    const km2 = r.total / 1e6;
    expect(km2).toBeGreaterThan(70_000);
    expect(km2).toBeLessThan(105_000);
  });

  it("can be split within a fraction of a point by some straight line", () => {
    const best = bestBalancedLine(country);
    expect(Math.abs(best.fractionA - 0.5)).toBeLessThan(0.01);
  });
});
