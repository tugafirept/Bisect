import type { Feature } from "geojson";
import { rewindGeometry } from "../game/rewind";
import type { PopulationField } from "../game/population";
import type { RiverField } from "../game/rivers";

export interface CountryMeta {
  id: string;
  /** ISO 3166-1 alpha-2, for joining external datasets */
  iso_a2?: string;
  name: string; // pt
  name_en?: string;
  name_es?: string;
  name_fr?: string;
  name_de?: string;
  file: string;
  /** 1 (compact) .. 5 (spindly / fragmented) */
  difficulty: number;
  /** geodesic area in km², after trimming far-flung territories */
  area_km2: number;
  /** Natural Earth POP_EST (0 if unknown) */
  pop_est?: number;
  /** disjoint polygons in the trimmed geometry */
  polygons: number;
  /** "area" always; "population" when the country has enough cities */
  modes: string[];
  /** number of cities in the population field, when present */
  cities?: number;
}

export interface Manifest {
  generated: string;
  source: string;
  count: number;
  countries: CountryMeta[];
}

const base = import.meta.env.BASE_URL;

export async function loadManifest(): Promise<Manifest> {
  const res = await fetch(`${base}data/manifest.json`);
  if (!res.ok) throw new Error(`manifest not found (${res.status})`);
  return res.json() as Promise<Manifest>;
}

export async function loadCountry(meta: CountryMeta): Promise<Feature> {
  const res = await fetch(`${base}${meta.file}`);
  if (!res.ok) throw new Error(`country ${meta.id} not found (${res.status})`);
  const feature = (await res.json()) as Feature;
  const geom = feature.geometry;
  if (geom && (geom.type === "Polygon" || geom.type === "MultiPolygon")) {
    // GeoJSON's Position is number[]; our rewind uses [number, number] tuples.
    feature.geometry = rewindGeometry(geom as never);
  }
  return feature;
}

export async function loadPopulation(id: string): Promise<PopulationField> {
  const res = await fetch(`${base}data/population/${id}.json`);
  if (!res.ok) throw new Error(`population ${id} not found (${res.status})`);
  return res.json() as Promise<PopulationField>;
}

export async function loadRivers(id: string): Promise<RiverField> {
  const res = await fetch(`${base}data/rivers/${id}.json`);
  if (!res.ok) throw new Error(`rivers ${id} not found (${res.status})`);
  return res.json() as Promise<RiverField>;
}
