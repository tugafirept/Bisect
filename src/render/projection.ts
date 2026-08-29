import { geoMercator, type GeoProjection } from "d3-geo";
import type { Feature } from "geojson";

/** A Mercator projection scaled and centred to fit the country in the canvas. */
export function fitProjection(
  feature: Feature,
  width: number,
  height: number,
  padding = 28,
): GeoProjection {
  return geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    // d3-geo has its own GeoJSON typings; a plain Feature is compatible at runtime.
    feature as unknown as Parameters<GeoProjection["fitExtent"]>[1],
  );
}
