/**
 * Build per-country polygon files + manifest.json from Natural Earth.
 *
 *   npm run data:countries
 *
 * Pipeline:
 *   1. download NE 1:50m admin_0_countries (cached in data-src/)
 *   2. drop dependencies / Antarctica
 *   3. simplify with mapshaper — detail scaled to each country's size, so a
 *      small country keeps its shape (3 km on Canada is invisible; it is the
 *      whole width of Malta)
 *   4. per country: trim far-flung territories, drop if < MIN_AREA_KM2,
 *      compute a 1-5 difficulty from compactness + fragment count
 *   5. write public/data/countries/<ISO>.json + public/data/manifest.json
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore - mapshaper ships no type declarations
import mapshaper from "mapshaper";
import {
  bounds,
  multiPolygonArea,
  ringArea,
  type MultiPolygonCoords,
  type Position,
} from "../src/game/geo.ts";
import { rewindGeometry } from "../src/game/rewind.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const SOURCE_FILE = path.join(ROOT, "data-src", "ne_50m_admin_0_countries.geojson");
const OUT_DIR = path.join(ROOT, "public", "data", "countries");
const MANIFEST_FILE = path.join(ROOT, "public", "data", "manifest.json");

// Simplification detail by country size (bbox span in degrees, 1 deg ~ 111 km).
const SIMPLIFY_BUCKETS = [
  { minSpan: 6, interval: 3000, precision: 0.001 }, // Canada, Russia, Brazil ...
  { minSpan: 2, interval: 1200, precision: 0.001 }, // Portugal, Switzerland ...
  { minSpan: 0, interval: 250, precision: 0.0003 }, // Malta, Luxembourg, Singapore ...
] as const;
const MIN_AREA_KM2 = 100; // drop only true city-states (Monaco, Vatican, Nauru, Tuvalu, San Marino)
const TERRITORY_MARGIN_DEG = 5; // keep only polygons hugging the main landmass
const EXCLUDE_ADM0_A3 = new Set(["ATA"]); // Antarctica

interface RawFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

interface CountryEntry {
  id: string;
  iso_a2: string;
  name: string; // pt
  name_en: string;
  name_es: string;
  name_fr: string;
  name_de: string;
  area_km2: number;
  pop_est: number;
  difficulty: number;
  polygons: number;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

async function ensureSource(): Promise<string> {
  if (existsSync(SOURCE_FILE)) return readFile(SOURCE_FILE, "utf8");
  console.log("- downloading Natural Earth 1:50m admin_0_countries ...");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const text = await res.text();
  await mkdir(path.dirname(SOURCE_FILE), { recursive: true });
  await writeFile(SOURCE_FILE, text);
  return text;
}

async function simplify(
  features: RawFeature[],
  interval: number,
  precision: number,
): Promise<RawFeature[]> {
  const cmd =
    `-i input.geojson snap ` +
    `-simplify interval=${interval} weighted keep-shapes ` +
    `-o output.geojson precision=${precision} format=geojson`;
  const out: Record<string, string> = await mapshaper.applyCommands(cmd, {
    "input.geojson": JSON.stringify({ type: "FeatureCollection", features }),
  });
  return (JSON.parse(out["output.geojson"]!) as { features: RawFeature[] }).features;
}

function bboxSpan(geometry: RawFeature["geometry"]): number {
  const mp = toMultiPolygon(geometry);
  if (mp.length === 0) return Infinity;
  const b = bounds(mp);
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
}

function toMultiPolygon(geometry: RawFeature["geometry"]): MultiPolygonCoords {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates as MultiPolygonCoords[number]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as MultiPolygonCoords;
  return [];
}

/** Keep the largest polygon and anything within TERRITORY_MARGIN_DEG of it. */
function trimTerritories(mp: MultiPolygonCoords): MultiPolygonCoords {
  if (mp.length <= 1) return mp;

  let largest = 0;
  let largestArea = -1;
  for (let i = 0; i < mp.length; i++) {
    const area = multiPolygonArea([mp[i]!]);
    if (area > largestArea) {
      largestArea = area;
      largest = i;
    }
  }

  const b = bounds([mp[largest]!]);
  const minX = b.minX - TERRITORY_MARGIN_DEG;
  const maxX = b.maxX + TERRITORY_MARGIN_DEG;
  const minY = b.minY - TERRITORY_MARGIN_DEG;
  const maxY = b.maxY + TERRITORY_MARGIN_DEG;

  return mp.filter((poly) => {
    const pb = bounds([poly]);
    return pb.minX <= maxX && pb.maxX >= minX && pb.minY <= maxY && pb.maxY >= minY;
  });
}

function convexHull(points: Position[]): Position[] {
  const pts = points
    .slice()
    .sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  if (pts.length < 3) return pts;

  const cross = (o: Position, a: Position, b: Position): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const build = (source: Position[]): Position[] => {
    const stack: Position[] = [];
    for (const p of source) {
      while (
        stack.length >= 2 &&
        cross(stack[stack.length - 2]!, stack[stack.length - 1]!, p) <= 0
      ) {
        stack.pop();
      }
      stack.push(p);
    }
    stack.pop();
    return stack;
  };

  return build(pts).concat(build(pts.slice().reverse()));
}

/** 1 (compact, e.g. Poland) .. 5 (spindly / fragmented, e.g. Chile). */
function difficulty(mp: MultiPolygonCoords, areaM2: number): number {
  const outerPoints: Position[] = [];
  for (const poly of mp) for (const p of poly[0] ?? []) outerPoints.push(p as Position);

  const hull = convexHull(outerPoints);
  const hullArea = hull.length >= 3 ? Math.abs(ringArea([...hull, hull[0]!])) : 0;
  const compactness = hullArea > 0 ? Math.min(areaM2 / hullArea, 1) : 1;
  const fragments = Math.min(mp.length, 15) / 15;

  const raw = (1 - compactness) * 0.7 + fragments * 0.3;
  return Math.max(1, Math.min(5, 1 + Math.round(raw * 4)));
}

function countryId(props: Record<string, unknown>): string {
  const eh = props.ISO_A3_EH;
  if (typeof eh === "string" && eh !== "-99" && eh !== "") return eh.toUpperCase();
  const adm = props.ADM0_A3;
  if (typeof adm === "string" && adm !== "" && adm !== "-99") return adm.toUpperCase();
  return "";
}

function countryA2(props: Record<string, unknown>): string {
  for (const key of ["ISO_A2_EH", "ISO_A2", "WB_A2", "FIPS_10"]) {
    const v = props[key];
    if (typeof v === "string" && v !== "-99" && v.length === 2) return v.toUpperCase();
  }
  return "";
}

async function main(): Promise<void> {
  const raw = await ensureSource();
  const source = JSON.parse(raw) as { features: RawFeature[] };

  const filtered = source.features.filter((f) => {
    if (f.properties.TYPE === "Dependency") return false;
    const adm = f.properties.ADM0_A3;
    return !(typeof adm === "string" && EXCLUDE_ADM0_A3.has(adm));
  });
  console.log(
    `features: ${source.features.length} -> after filter: ${filtered.length}`,
  );

  console.log("simplifying with mapshaper (detail scaled to country size) ...");
  const simplifiedFeatures: RawFeature[] = [];
  for (const bucket of SIMPLIFY_BUCKETS) {
    const feats = filtered.filter(
      (f) =>
        f.geometry != null &&
        SIMPLIFY_BUCKETS.find((b) => bboxSpan(f.geometry) >= b.minSpan) === bucket,
    );
    if (feats.length === 0) continue;
    simplifiedFeatures.push(
      ...(await simplify(feats, bucket.interval, bucket.precision)),
    );
    console.log(`  ${feats.length} countries @ ${bucket.interval} m`);
  }

  const byId = new Map<string, CountryEntry>();
  let skippedSmall = 0;

  for (const f of simplifiedFeatures) {
    const id = countryId(f.properties);
    if (!id) continue;

    const mp = trimTerritories(toMultiPolygon(f.geometry));
    if (mp.length === 0) continue;

    const areaM2 = multiPolygonArea(mp);
    const areaKm2 = Math.round(areaM2 / 1e6);
    if (areaKm2 < MIN_AREA_KM2) {
      skippedSmall++;
      continue;
    }

    const geometry: CountryEntry["geometry"] = rewindGeometry(
      mp.length === 1
        ? { type: "Polygon" as const, coordinates: mp[0]! }
        : { type: "MultiPolygon" as const, coordinates: mp },
    );

    const fallbackName =
      (f.properties.NAME as string) || (f.properties.NAME_LONG as string) || id;
    const nameIn = (key: string): string =>
      (f.properties[key] as string) || fallbackName;

    const popEst = Number(f.properties.POP_EST);

    const entry: CountryEntry = {
      id,
      iso_a2: countryA2(f.properties),
      name: nameIn("NAME_PT"),
      name_en: nameIn("NAME_EN"),
      name_es: nameIn("NAME_ES"),
      name_fr: nameIn("NAME_FR"),
      name_de: nameIn("NAME_DE"),
      area_km2: areaKm2,
      pop_est: Number.isFinite(popEst) && popEst > 0 ? Math.round(popEst) : 0,
      difficulty: difficulty(mp, areaM2),
      polygons: mp.length,
      geometry,
    };

    const prev = byId.get(id);
    if (!prev || prev.area_km2 < entry.area_km2) byId.set(id, entry);
  }

  const entries = [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt"),
  );

  await mkdir(OUT_DIR, { recursive: true });
  for (const file of await readdir(OUT_DIR)) {
    if (file.endsWith(".json")) await rm(path.join(OUT_DIR, file));
  }

  let totalBytes = 0;
  for (const e of entries) {
    const feature = {
      type: "Feature",
      id: e.id,
      properties: {
        name: e.name,
        name_en: e.name_en,
        name_es: e.name_es,
        name_fr: e.name_fr,
        name_de: e.name_de,
        iso: e.id,
        iso_a2: e.iso_a2,
        area_km2: e.area_km2,
        pop_est: e.pop_est,
        difficulty: e.difficulty,
        polygons: e.polygons,
      },
      geometry: e.geometry,
    };
    const json = JSON.stringify(feature);
    totalBytes += Buffer.byteLength(json);
    await writeFile(path.join(OUT_DIR, `${e.id}.json`), json);
  }

  const manifest = {
    generated: new Date().toISOString().slice(0, 10),
    source: "Natural Earth 1:50m admin_0_countries (nvkelso/natural-earth-vector)",
    count: entries.length,
    countries: entries.map((e) => ({
      id: e.id,
      iso_a2: e.iso_a2,
      name: e.name,
      name_en: e.name_en,
      name_es: e.name_es,
      name_fr: e.name_fr,
      name_de: e.name_de,
      file: `data/countries/${e.id}.json`,
      area_km2: e.area_km2,
      pop_est: e.pop_est,
      difficulty: e.difficulty,
      polygons: e.polygons,
      modes: ["area"],
    })),
  };
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  console.log(
    `\nwrote ${entries.length} countries ` +
      `(${(totalBytes / 1024 / 1024).toFixed(2)} MB total, ` +
      `avg ${(totalBytes / entries.length / 1024).toFixed(0)} KB), skipped ${skippedSmall} < ${MIN_AREA_KM2} km2`,
  );

  const biggestFiles = [...entries]
    .map((e) => ({
      id: e.id,
      name: e.name,
      km2: e.area_km2,
      diff: e.difficulty,
      poly: e.polygons,
      kb: Math.round(Buffer.byteLength(JSON.stringify(e.geometry)) / 1024),
    }))
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 10);
  console.log("\nlargest files:");
  console.table(biggestFiles);

  const byTier = [1, 2, 3, 4, 5].map(
    (t) => `${t}:${entries.filter((e) => e.difficulty === t).length}`,
  );
  console.log("difficulty spread  ", byTier.join("  "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
