/**
 * Build per-country river polyline files from Natural Earth, and flag which
 * countries get the "rivers" round in the manifest.
 *
 *   npm run data:rivers        (run AFTER data:countries and data:population)
 *
 * Rivers follow terrain, not the coast, so "divide the total river length 50/50"
 * is a genuinely different puzzle from area or population (which both hug the
 * coast in a country like Portugal).
 *
 * Data: Natural Earth 1:10m rivers + lake centerlines (public domain).
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bounds, type MultiPolygonCoords, type Position } from "../src/game/geo.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson";
const SOURCE_FILE = path.join(ROOT, "data-src", "ne_10m_rivers_lake_centerlines.geojson");
const COUNTRIES_DIR = path.join(ROOT, "public", "data", "countries");
const OUT_DIR = path.join(ROOT, "public", "data", "rivers");
const MANIFEST_FILE = path.join(ROOT, "public", "data", "manifest.json");

const MIN_RIVER_KM = 40; // country needs at least this much mapped river
const THIN_DEG = 0.02; // drop vertices closer than ~2 km to the previous kept one
const MAX_VERTICES = 4000; // keep the longest polylines up to this budget per country

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

const EARTH_R = 6371008.8;
const rad = (d: number): number => (d * Math.PI) / 180;
function segMetres(a: Position, b: Position): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

/** even-odd ray cast over every ring of the multipolygon (handles holes) */
function inPolygon(mp: MultiPolygonCoords, x: number, y: number): boolean {
  let inside = false;
  for (const poly of mp) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i]![0]!;
        const yi = ring[i]![1]!;
        const xj = ring[j]![0]!;
        const yj = ring[j]![1]!;
        if (
          yi > y !== yj > y &&
          x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        ) {
          inside = !inside;
        }
      }
    }
  }
  return inside;
}

function thin(pl: Position[]): Position[] {
  if (pl.length <= 2) return pl;
  const out: Position[] = [pl[0]!];
  for (let i = 1; i < pl.length - 1; i++) {
    const last = out[out.length - 1]!;
    if (Math.hypot(pl[i]![0] - last[0], pl[i]![1] - last[1]) >= THIN_DEG) {
      out.push(pl[i]!);
    }
  }
  out.push(pl[pl.length - 1]!);
  return out;
}

interface RiverFeature {
  properties: { featurecla?: string };
  geometry: { type: string; coordinates: Position[][] };
}

async function ensureSource(): Promise<string> {
  if (existsSync(SOURCE_FILE)) return readFile(SOURCE_FILE, "utf8");
  console.log("- downloading Natural Earth 1:10m rivers ...");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const text = await res.text();
  await mkdir(path.dirname(SOURCE_FILE), { recursive: true });
  await writeFile(SOURCE_FILE, text);
  return text;
}

function toMultiPolygon(geometry: {
  type: string;
  coordinates: unknown;
}): MultiPolygonCoords {
  if (geometry.type === "Polygon") return [geometry.coordinates as MultiPolygonCoords[number]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as MultiPolygonCoords;
  return [];
}

async function main(): Promise<void> {
  const src = JSON.parse(await ensureSource()) as { features: RiverFeature[] };
  const rivers = src.features.filter((f) => f.properties.featurecla === "River");
  console.log(`rivers: ${rivers.length} features`);

  const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8")) as {
    generated: string;
    countries: Array<{ id: string; name: string; modes: string[]; rivers?: number }>;
  };

  await mkdir(OUT_DIR, { recursive: true });
  for (const file of await readdir(OUT_DIR)) {
    if (file.endsWith(".json")) await rm(path.join(OUT_DIR, file));
  }

  let withRivers = 0;
  let totalBytes = 0;
  const bytesById = new Map<string, number>();
  const skipped: string[] = [];

  for (const country of manifest.countries) {
    const geo = JSON.parse(
      await readFile(path.join(COUNTRIES_DIR, `${country.id}.json`), "utf8"),
    ) as { geometry: { type: string; coordinates: unknown } };
    const mp = toMultiPolygon(geo.geometry);
    const b = bounds(mp);
    const [bx0, by0, bx1, by1] = [b.minX - 0.5, b.minY - 0.5, b.maxX + 0.5, b.maxY + 0.5];

    const polylines: Position[][] = [];
    let totalM = 0;

    for (const f of rivers) {
      for (const line of f.geometry.coordinates) {
        if (!line.some(([x, y]) => x >= bx0 && x <= bx1 && y >= by0 && y <= by1)) {
          continue;
        }
        let current: Position[] = [];
        const flush = (): void => {
          if (current.length >= 2) polylines.push(thin(current));
          current = [];
        };
        for (let i = 0; i < line.length - 1; i++) {
          const p1 = line[i]!;
          const p2 = line[i + 1]!;
          const mx = (p1[0] + p2[0]) / 2;
          const my = (p1[1] + p2[1]) / 2;
          if (mx < bx0 || mx > bx1 || my < by0 || my > by1 || !inPolygon(mp, mx, my)) {
            flush();
            continue;
          }
          if (current.length === 0) current.push(p1);
          current.push(p2);
          totalM += segMetres(p1, p2);
        }
        flush();
      }
    }

    const totalKm = Math.round(totalM / 1000);

    if (totalKm < MIN_RIVER_KM || polylines.length === 0) {
      country.rivers = polylines.length;
      country.modes = country.modes.filter((m) => m !== "rivers");
      skipped.push(`${country.id}(${totalKm}km)`);
      continue;
    }

    // keep the longest polylines within a per-country vertex budget
    polylines.sort((a, b) => b.length - a.length);
    const kept: Position[][] = [];
    let vertices = 0;
    let keptM = 0;
    for (const pl of polylines) {
      if (vertices >= MAX_VERTICES) break;
      kept.push(pl);
      vertices += pl.length;
      for (let i = 0; i < pl.length - 1; i++) keptM += segMetres(pl[i]!, pl[i + 1]!);
    }
    country.rivers = kept.length;

    const compact = kept.map((pl) =>
      pl.map(([x, y]) => [round3(x), round3(y)] as [number, number]),
    );
    const json = JSON.stringify({
      id: country.id,
      totalKm: Math.round(keptM / 1000),
      rivers: compact,
    });
    const bytes = Buffer.byteLength(json);
    totalBytes += bytes;
    bytesById.set(country.id, bytes);
    await writeFile(path.join(OUT_DIR, `${country.id}.json`), json);

    // insert "rivers" as round 2, before "population"
    const modes = country.modes.filter((m) => m !== "rivers");
    const popIdx = modes.indexOf("population");
    if (popIdx >= 0) modes.splice(popIdx, 0, "rivers");
    else modes.push("rivers");
    country.modes = modes;
    withRivers++;
  }

  manifest.generated = new Date().toISOString().slice(0, 10);
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  console.log(
    `\nrivers round: ${withRivers} / ${manifest.countries.length} countries ` +
      `(${(totalBytes / 1024 / 1024).toFixed(2)} MB total, avg ${(totalBytes / withRivers / 1024).toFixed(1)} KB)`,
  );
  console.log(`without enough river (${skipped.length}): ${skipped.slice(0, 40).join(" ")}`);

  const largest = [...bytesById.entries()]
    .map(([id, bytes]) => ({
      id,
      name: manifest.countries.find((c) => c.id === id)?.name,
      kb: Math.round(bytes / 1024),
    }))
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 8);
  console.table(largest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
