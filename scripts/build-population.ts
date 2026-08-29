/**
 * Build per-country city-population files from the GeoNames gazetteer, and flag
 * which countries get the "population" mode in the manifest.
 *
 *   npm run data:population        (run AFTER data:countries)
 *
 * GeoNames `cities1000` (every place with population >= 1000, ~140k rows) gives
 * good coverage even for small countries. Cities-only is still a coarse proxy for
 * "where people live", but the on-disk shape (weighted points) is identical to a
 * future raster grid, so the game mode never has to change.
 *
 * Data: GeoNames (https://www.geonames.org/), licensed CC BY 4.0.
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore - adm-zip types are optional
import AdmZip from "adm-zip";
import { bounds, type MultiPolygonCoords } from "../src/game/geo.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_URL = "https://download.geonames.org/export/dump/cities1000.zip";
const SOURCE_FILE = path.join(ROOT, "data-src", "cities1000.txt");
const COUNTRIES_DIR = path.join(ROOT, "public", "data", "countries");
const OUT_DIR = path.join(ROOT, "public", "data", "population");
const MANIFEST_FILE = path.join(ROOT, "public", "data", "manifest.json");

const MIN_CITIES = 5;
const CAP_PER_COUNTRY = 250;
const BBOX_MARGIN_DEG = 0.75;

// GeoNames feature codes that are not present-day inhabited places
const SKIP_FEATURE_CODES = new Set(["PPLW", "PPLQ", "PPLH", "PPLCH"]);

interface City {
  lng: number;
  lat: number;
  pop: number;
  cc: string;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

async function ensureSource(): Promise<string> {
  if (existsSync(SOURCE_FILE)) return readFile(SOURCE_FILE, "utf8");
  console.log("- downloading GeoNames cities1000 ...");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
  const text: string = zip.readAsText("cities1000.txt");
  await mkdir(path.dirname(SOURCE_FILE), { recursive: true });
  await writeFile(SOURCE_FILE, text);
  return text;
}

function parseCities(tsv: string): Map<string, City[]> {
  const byCc = new Map<string, City[]>();
  for (const line of tsv.split("\n")) {
    if (!line) continue;
    const col = line.split("\t");
    // 4 lat, 5 lng, 6 feature class, 7 feature code, 8 country code, 14 population
    if (col[6] !== "P") continue;
    if (col[7] && SKIP_FEATURE_CODES.has(col[7])) continue;
    const cc = col[8];
    const pop = Number(col[14]);
    const lat = Number(col[4]);
    const lng = Number(col[5]);
    if (!cc || !Number.isFinite(pop) || pop <= 0) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const bucket = byCc.get(cc);
    const city: City = { lng, lat, pop, cc };
    if (bucket) bucket.push(city);
    else byCc.set(cc, [city]);
  }
  return byCc;
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
  const tsv = await ensureSource();
  const byCc = parseCities(tsv);
  console.log(
    `cities: ${[...byCc.values()].reduce((n, a) => n + a.length, 0)} in ${byCc.size} country codes`,
  );

  const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8")) as {
    generated: string;
    countries: Array<{
      id: string;
      iso_a2?: string;
      name: string;
      modes: string[];
      cities?: number;
    }>;
  };

  await mkdir(OUT_DIR, { recursive: true });
  for (const file of await readdir(OUT_DIR)) {
    if (file.endsWith(".json")) await rm(path.join(OUT_DIR, file));
  }

  let withPop = 0;
  let totalBytes = 0;
  const missing: string[] = [];

  for (const country of manifest.countries) {
    const geo = JSON.parse(
      await readFile(path.join(COUNTRIES_DIR, `${country.id}.json`), "utf8"),
    ) as { geometry: { type: string; coordinates: unknown } };
    const b = bounds(toMultiPolygon(geo.geometry));
    const m = BBOX_MARGIN_DEG;

    const candidates = country.iso_a2 ? (byCc.get(country.iso_a2) ?? []) : [];
    const kept = candidates
      .filter(
        (c) =>
          c.lng >= b.minX - m &&
          c.lng <= b.maxX + m &&
          c.lat >= b.minY - m &&
          c.lat <= b.maxY + m,
      )
      .sort((x, y) => y.pop - x.pop)
      .slice(0, CAP_PER_COUNTRY);

    if (kept.length < MIN_CITIES) {
      country.modes = ["area"];
      country.cities = kept.length;
      missing.push(`${country.id}(${kept.length})`);
      continue;
    }

    const cities = kept.map(
      (c) => [round3(c.lng), round3(c.lat), Math.round(c.pop)] as [number, number, number],
    );
    const total = cities.reduce((s, p) => s + p[2], 0);

    const json = JSON.stringify({ id: country.id, total, cities });
    totalBytes += Buffer.byteLength(json);
    await writeFile(path.join(OUT_DIR, `${country.id}.json`), json);

    country.modes = country.modes.includes("rivers")
      ? ["area", "rivers", "population"]
      : ["area", "population"];
    country.cities = cities.length;
    withPop++;
  }

  manifest.generated = new Date().toISOString().slice(0, 10);
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  console.log(
    `\npopulation mode: ${withPop} / ${manifest.countries.length} countries ` +
      `(${(totalBytes / 1024 / 1024).toFixed(2)} MB total, avg ${(totalBytes / withPop / 1024).toFixed(1)} KB)`,
  );
  if (missing.length) console.log(`still area-only (${missing.length}): ${missing.join(" ")}`);

  const largest = manifest.countries
    .filter((c) => c.modes.includes("population"))
    .sort((a, b) => (b.cities ?? 0) - (a.cities ?? 0))
    .slice(0, 8)
    .map((c) => ({ id: c.id, name: c.name, cities: c.cities }));
  console.table(largest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
