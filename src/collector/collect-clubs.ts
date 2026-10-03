import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import gasClubsJson from "../../data/gas-clubs.json" with { type: "json" };

export type GasClubSeed = {
  clubNumber: number;
  clubId: string;
  name: string;
};

export function resolveDataDir(explicit?: string): string {
  if (explicit) return explicit;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), "data"),
    path.join(here, "data"),
    path.join(here, "..", "data"),
    path.join(here, "..", "..", "data"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "gas-clubs.json"))) return dir;
  }
  return path.join(process.cwd(), "data");
}

export function loadGasClubs(dataDir?: string): GasClubSeed[] {
  // Prefer filesystem when present (local / copied dist/data); fall back to bundled JSON.
  const dir = resolveDataDir(dataDir);
  const file = path.join(dir, "gas-clubs.json");
  const raw = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as GasClubSeed[])
    : (gasClubsJson as GasClubSeed[]);
  return raw.map((c) => ({
    clubNumber: c.clubNumber,
    clubId: c.clubId,
    name: c.name,
  }));
}
