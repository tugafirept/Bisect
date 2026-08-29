import { describe, expect, it } from "vitest";
import { geoArea } from "d3-geo";
import type { Feature } from "geojson";
import { rewindGeometry, rewindRings } from "./rewind";
import prt from "../../public/data/countries/PRT.json";
import slv from "../../public/data/countries/SLV.json";

const asFeature = (geometry: unknown): Feature =>
  ({ type: "Feature", properties: {}, geometry }) as Feature;

// A CCW (RFC 7946 exterior) square — the winding mapshaper emits and d3 reads inside-out.
const ccwSquare: [number, number][][] = [
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ],
];

describe("rewindRings", () => {
  it("flips a CCW exterior ring to the orientation d3-geo expects", () => {
    const before = geoArea(asFeature({ type: "Polygon", coordinates: ccwSquare }));
    const after = geoArea(
      asFeature({ type: "Polygon", coordinates: rewindRings(ccwSquare) }),
    );
    expect(before).toBeGreaterThan(6); // most of the globe — inside-out
    expect(after).toBeLessThan(0.05); // a ~0.03 sr patch — correct
  });

  it("is idempotent", () => {
    const once = rewindRings(ccwSquare);
    const twice = rewindRings(once);
    expect(twice).toEqual(once);
  });
});

describe("stored country files are wound for d3-geo", () => {
  it("Portugal and El Salvador cover a small area, not the whole sphere", () => {
    for (const raw of [prt, slv]) {
      const sr = geoArea(raw as unknown as Feature);
      expect(sr).toBeLessThan(1);
      // rewindGeometry must be a no-op on already-correct data
      const sr2 = geoArea(asFeature(rewindGeometry((raw as any).geometry)));
      expect(sr2).toBeCloseTo(sr, 6);
    }
  });
});
