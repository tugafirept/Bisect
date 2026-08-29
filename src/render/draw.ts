import { geoPath, type GeoProjection } from "d3-geo";
import type { Feature } from "geojson";
import type { MultiPolygonCoords, Position } from "../game/geo";

type Ctx = CanvasRenderingContext2D;

export function clear(ctx: Ctx, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
}

function tracer(ctx: Ctx, projection: GeoProjection) {
  // d3-geo writes into the context path but does not begin/fill it for us.
  return geoPath(projection, ctx);
}

export function fillFeature(
  ctx: Ctx,
  projection: GeoProjection,
  feature: Feature,
  fill: string,
): void {
  ctx.beginPath();
  tracer(ctx, projection)(feature as never);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function fillMultiPolygon(
  ctx: Ctx,
  projection: GeoProjection,
  coordinates: MultiPolygonCoords,
  fill: string,
): void {
  if (coordinates.length === 0) return;
  ctx.beginPath();
  tracer(ctx, projection)({ type: "MultiPolygon", coordinates } as never);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeFeature(
  ctx: Ctx,
  projection: GeoProjection,
  feature: Feature,
  color: string,
  lineWidth = 1.5,
): void {
  ctx.beginPath();
  tracer(ctx, projection)(feature as never);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/** Draw the guess line, extended well past both handles. */
export function drawLine(
  ctx: Ctx,
  p1: Position,
  p2: Position,
  color = "#1f2933",
  dashed = true,
): void {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy) || 1;
  const ex = (dx / len) * 4000;
  const ey = (dy / len) * 4000;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p1[0] - ex, p1[1] - ey);
  ctx.lineTo(p2[0] + ex, p2[1] + ey);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([7, 7]);
  ctx.stroke();
  ctx.restore();
}

/**
 * City markers. `sized` = radius proportional to population (population round);
 * otherwise a small uniform dot (city-count round).
 */
export function drawCities(
  ctx: Ctx,
  projection: GeoProjection,
  cities: ReadonlyArray<readonly [number, number, number]>,
  maxPop: number,
  sized = true,
): void {
  if (sized && maxPop <= 0) return;
  ctx.save();
  ctx.fillStyle = "rgba(31, 41, 51, 0.5)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 1;
  for (const [lng, lat, pop] of cities) {
    const p = projection([lng, lat]);
    if (!p) continue;
    const r = sized ? 2 + 9 * Math.sqrt(Math.max(pop, 0) / maxPop) : 3;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** River polylines for the rivers round. */
export function drawRivers(
  ctx: Ctx,
  projection: GeoProjection,
  rivers: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  color = "#0b3d91",
  lineWidth = 1.6,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const line of rivers) {
    ctx.beginPath();
    let started = false;
    for (const [lng, lat] of line) {
      const p = projection([lng, lat]);
      if (!p) continue;
      if (started) ctx.lineTo(p[0], p[1]);
      else {
        ctx.moveTo(p[0], p[1]);
        started = true;
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHandle(ctx: Ctx, p: Position, active = false): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p[0], p[1], active ? 11 : 9, 0, Math.PI * 2);
  ctx.fillStyle = active ? "#ff5252" : "#ffffff";
  ctx.strokeStyle = "#1f2933";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
