// d3-geo decides a spherical polygon's inside from its ring winding, and it
// expects the opposite orientation to GeoJSON RFC 7946 (which mapshaper emits).
// Get it wrong and d3 fills "the whole globe except the country".
//
// Our `ringArea` is positive for the orientation d3 treats as exterior, so:
// ring 0 (exterior) must be positive, holes negative. Idempotent.

import {
  ringArea,
  type MultiPolygonCoords,
  type PolygonCoords,
  type Ring,
} from "./geo";

export function rewindRings(polygon: PolygonCoords): PolygonCoords {
  return polygon.map((ring, index) => {
    const signed = ringArea(ring);
    if (signed === 0) return ring;
    const wantPositive = index === 0;
    const wrong = wantPositive ? signed < 0 : signed > 0;
    return wrong ? (ring.slice().reverse() as Ring) : ring;
  });
}

export function rewindMultiPolygon(mp: MultiPolygonCoords): MultiPolygonCoords {
  return mp.map(rewindRings);
}

export interface RingedGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: PolygonCoords | MultiPolygonCoords;
}

export function rewindGeometry<G extends RingedGeometry>(geometry: G): G {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: rewindRings(geometry.coordinates as PolygonCoords),
    };
  }
  return {
    ...geometry,
    coordinates: rewindMultiPolygon(geometry.coordinates as MultiPolygonCoords),
  };
}
