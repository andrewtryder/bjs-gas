import { mkdir, readFile, writeFile, stat, copyFile } from "node:fs/promises";
import path from "node:path";
import {
  CLUB_SEARCH_URL,
  STATE_TOWNS_URL,
  closeBjsBrowserSession,
  fetchAllClubsViaSearch,
  fetchClubsFromRawFile,
  fetchStateTownClubIds,
  mapPool,
  openBjsBrowserSession,
  probeFuelPrice,
} from "./bjs-client.js";
import {
  dedupeClubsByNumber,
  normalizeClubId,
  normalizePhysicalStore,
} from "./normalize.js";
import type { BjsClub, DiscoverySummary } from "./types.js";
import { coerceClub } from "./types.js";
import { assertValidOrThrow, buildSummary, validateClubs } from "./validate.js";
import { canonicalizeGasClubs, loadGasStationAliases } from "./gas-station-alias.js";

const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const CLUBS_PATH = path.join(DATA_DIR, "clubs.json");
export const GAS_CLUBS_PATH = path.join(DATA_DIR, "gas-clubs.json");
export const SUMMARY_PATH = path.join(DATA_DIR, "discovery-summary.json");
export const CLUBS_CANDIDATE_PATH = path.join(DATA_DIR, "clubs.candidate.json");
export const GAS_CLUBS_CANDIDATE_PATH = path.join(DATA_DIR, "gas-clubs.candidate.json");
export const SUMMARY_CANDIDATE_PATH = path.join(DATA_DIR, "discovery-summary.candidate.json");
export const DIFF_STAMP_PATH = path.join(DATA_DIR, "discovery-diff.ok.json");

const DISCOVERY_METHOD =
  "POST club/search/10201 with large US-radius body via headless Chrome (Playwright persistent profile)";

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readAuthoritativeClubs(): Promise<BjsClub[]> {
  const raw = JSON.parse(await readFile(CLUBS_PATH, "utf8")) as unknown[];
  return (raw as Parameters<typeof coerceClub>[0][]).map(coerceClub);
}

export async function readCandidateClubs(): Promise<BjsClub[]> {
  const raw = JSON.parse(await readFile(CLUBS_CANDIDATE_PATH, "utf8")) as unknown[];
  return (raw as Parameters<typeof coerceClub>[0][]).map(coerceClub);
}

async function clubsFromStores(
  stores: Awaited<ReturnType<typeof fetchAllClubsViaSearch>>["stores"],
  source: string,
  stateTownIds: string[],
): Promise<BjsClub[]> {
  const clubs = dedupeClubsByNumber(
    stores.map((store) => normalizePhysicalStore(store, source)),
  );

  if (stateTownIds.length > 0) {
    const searchIds = new Set(clubs.map((c) => c.clubId));
    const stateIds = new Set(stateTownIds.map((id) => normalizeClubId(id)));
    const missingFromSearch = [...stateIds].filter((id) => !searchIds.has(id));
    if (missingFromSearch.length > 0) {
      console.warn(
        `Warning: ${missingFromSearch.length} statetowns club(s) missing from search: ${missingFromSearch
          .slice(0, 20)
          .join(", ")}`,
      );
    } else {
      const onlySearch = [...searchIds].filter((id) => !stateIds.has(id));
      console.log(
        `statetowns cross-check: search has ${clubs.length}, index has ${stateIds.size}; search-only=${onlySearch.length}`,
      );
    }
  }

  return clubs;
}

export async function discoverClubs(): Promise<BjsClub[]> {
  const rawPath = process.env.BJS_RAW_CLUB_SEARCH?.trim();
  if (rawPath) {
    const { stores, source } = await fetchClubsFromRawFile(rawPath);
    return clubsFromStores(stores, source, []);
  }

  const session = await openBjsBrowserSession();
  try {
    const [{ stores, source }, stateTownIds] = await Promise.all([
      fetchAllClubsViaSearch(session.page),
      fetchStateTownClubIds(session.page).catch((error: unknown) => {
        console.warn(
          `statetowns cross-check skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return [] as string[];
      }),
    ]);

    return clubsFromStores(stores, source, stateTownIds);
  } finally {
    await closeBjsBrowserSession(session);
  }
}

/** Write discovery to candidate files — never overwrite authoritative registry. */
export async function writeCandidateOutputs(
  clubs: BjsClub[],
  summaryExtras?: Partial<DiscoverySummary>,
): Promise<DiscoverySummary> {
  await ensureDataDir();
  const sorted = [...clubs].sort((a, b) => a.clubNumber - b.clubNumber);
  const aliases = loadGasStationAliases();
  const rawGasClubs = sorted.filter((c) => c.hasGas && c.gasStatus === "yes");
  const gasClubs = canonicalizeGasClubs(rawGasClubs, aliases);

  const summary = {
    ...buildSummary(sorted, DISCOVERY_METHOD, [CLUB_SEARCH_URL, STATE_TOWNS_URL]),
    ...summaryExtras,
  };

  await writeJson(CLUBS_CANDIDATE_PATH, sorted);
  await writeJson(GAS_CLUBS_CANDIDATE_PATH, gasClubs);
  await writeJson(SUMMARY_CANDIDATE_PATH, summary);
  const { unlink } = await import("node:fs/promises");
  await unlink(DIFF_STAMP_PATH).catch(() => undefined);

  return summary;
}

export type DiscoveryDiff = {
  previousClubs: number;
  previousGas: number;
  candidateClubs: number;
  candidateGas: number;
  added: Array<{ clubNumber: number; name: string; hasGas: boolean; state: string }>;
  removed: Array<{ clubNumber: number; name: string; hasGas: boolean; state: string }>;
  hasGasFlips: Array<{ clubNumber: number; name: string; from: boolean; to: boolean }>;
  clean: boolean;
  warnings: string[];
};

export function diffClubRegistries(
  previous: BjsClub[],
  candidate: BjsClub[],
): DiscoveryDiff {
  const prevBy = new Map(previous.map((c) => [c.clubNumber, c]));
  const candBy = new Map(candidate.map((c) => [c.clubNumber, c]));

  const added = [...candBy.values()]
    .filter((c) => !prevBy.has(c.clubNumber))
    .map((c) => ({
      clubNumber: c.clubNumber,
      name: c.name,
      hasGas: c.hasGas,
      state: c.state,
    }))
    .sort((a, b) => a.clubNumber - b.clubNumber);

  const removed = [...prevBy.values()]
    .filter((c) => !candBy.has(c.clubNumber))
    .map((c) => ({
      clubNumber: c.clubNumber,
      name: c.name,
      hasGas: c.hasGas,
      state: c.state,
    }))
    .sort((a, b) => a.clubNumber - b.clubNumber);

  const hasGasFlips: DiscoveryDiff["hasGasFlips"] = [];
  for (const [n, prev] of prevBy) {
    const next = candBy.get(n);
    if (!next) continue;
    if (prev.hasGas !== next.hasGas) {
      hasGasFlips.push({
        clubNumber: n,
        name: next.name,
        from: prev.hasGas,
        to: next.hasGas,
      });
    }
  }

  const warnings: string[] = [];
  if (removed.length > 0) {
    warnings.push(
      `WARNING: ${removed.length} existing location(s) disappeared from candidate discovery. ` +
        `Refusing to automatically treat missing clubs as closed. Possible partial locator/Akamai response.`,
    );
    warnings.push(
      `Previous clubs: ${previous.length}; Discovered clubs: ${candidate.length}.`,
    );
  }

  return {
    previousClubs: previous.length,
    previousGas: previous.filter((c) => c.hasGas).length,
    candidateClubs: candidate.length,
    candidateGas: candidate.filter((c) => c.hasGas).length,
    added,
    removed,
    hasGasFlips,
    // Any disappearance blocks clean accept (plan: refuse unless --force).
    clean: removed.length === 0,
    warnings,
  };
}

export function formatDiscoveryDiff(diff: DiscoveryDiff): string {
  const lines: string[] = [];
  lines.push(`Previous: ${diff.previousClubs} clubs / ${diff.previousGas} gas`);
  lines.push(`Candidate: ${diff.candidateClubs} clubs / ${diff.candidateGas} gas`);
  lines.push("");
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.hasGasFlips.length === 0) {
    lines.push("No membership or hasGas changes.");
  } else {
    lines.push("Changes:");
    for (const a of diff.added) {
      lines.push(
        `+ ${String(a.clubNumber).padStart(4, "0")} ${a.name}, ${a.state} [${a.hasGas ? "gas" : "non-gas"}]`,
      );
    }
    for (const r of diff.removed) {
      lines.push(
        `- ${String(r.clubNumber).padStart(4, "0")} ${r.name}, ${r.state} [${r.hasGas ? "gas" : "non-gas"}]`,
      );
    }
    for (const f of diff.hasGasFlips) {
      lines.push(
        `~ ${String(f.clubNumber).padStart(4, "0")} ${f.name} hasGas ${f.from} → ${f.to}`,
      );
    }
  }
  for (const w of diff.warnings) {
    lines.push("");
    lines.push(w);
  }
  if (diff.clean) {
    lines.push("");
    lines.push("Diff is clean (no removals). Safe to run: pnpm discovery:accept");
  } else {
    lines.push("");
    lines.push("Diff is NOT clean. Use pnpm discovery:accept -- --force only after manual review.");
  }
  return lines.join("\n");
}

export async function runDiscoveryDiff(): Promise<DiscoveryDiff> {
  const previous = await readAuthoritativeClubs();
  const candidate = await readCandidateClubs();
  const diff = diffClubRegistries(previous, candidate);
  console.log(formatDiscoveryDiff(diff));
  if (diff.clean) {
    await writeJson(DIFF_STAMP_PATH, {
      generatedAt: new Date().toISOString(),
      clean: true,
      previousClubs: diff.previousClubs,
      candidateClubs: diff.candidateClubs,
    });
  } else {
    const { unlink } = await import("node:fs/promises");
    await unlink(DIFF_STAMP_PATH).catch(() => undefined);
  }
  return diff;
}

export async function runDiscoveryAccept(force = false): Promise<void> {
  const previous = await readAuthoritativeClubs();
  const candidate = await readCandidateClubs();
  const diff = diffClubRegistries(previous, candidate);
  console.log(formatDiscoveryDiff(diff));

  if (!diff.clean && !force) {
    throw new Error(
      "discovery:accept refused: candidate removes existing clubs. Re-run discovery:diff and use --force only after review.",
    );
  }
  if (!diff.clean && force) {
    console.warn("Proceeding with --force despite removals. Authoritative files will be overwritten.");
  }

  await copyFile(CLUBS_CANDIDATE_PATH, CLUBS_PATH);
  await copyFile(GAS_CLUBS_CANDIDATE_PATH, GAS_CLUBS_PATH);
  await copyFile(SUMMARY_CANDIDATE_PATH, SUMMARY_PATH).catch(async () => {
    // summary candidate may be missing on older runs
  });
  await writeJson(DIFF_STAMP_PATH, {
    generatedAt: new Date().toISOString(),
    accepted: true,
    forced: force,
    previousClubs: diff.previousClubs,
    candidateClubs: diff.candidateClubs,
  });
  console.log(
    `Accepted candidate → ${CLUBS_PATH} (${diff.candidateClubs} clubs, ${diff.candidateGas} gas). Next: pnpm import:clubs`,
  );
}

/** True when a candidate file is newer than authoritative clubs.json. */
export async function candidateIsNewerThanAuthoritative(): Promise<boolean> {
  try {
    const [c, a] = await Promise.all([stat(CLUBS_CANDIDATE_PATH), stat(CLUBS_PATH)]);
    return c.mtimeMs > a.mtimeMs;
  } catch {
    return false;
  }
}

export async function runDiscoverClubsOnly(): Promise<DiscoverySummary> {
  const clubs = await discoverClubs();
  assertValidOrThrow(validateClubs(clubs, { requireKnownGas: false }));
  const summary = await writeCandidateOutputs(clubs);
  console.log(
    `Wrote candidate ${summary.totalClubs} clubs to data/*.candidate.json — run pnpm discovery:diff next`,
  );
  return summary;
}

export async function runDiscoverGasFromExisting(): Promise<DiscoverySummary> {
  // Fuel probe may only upgrade unknown→yes when products exist.
  // Empty eisapi data must NEVER set hasGas false (inconclusive).
  const clubs = await readAuthoritativeClubs();
  if (clubs.length === 0) {
    throw new Error(`No clubs found in ${CLUBS_PATH}; run discover:clubs first`);
  }

  const unknowns = clubs.filter((c) => c.gasStatus === "unknown");
  if (unknowns.length === 0) {
    assertValidOrThrow(validateClubs(clubs));
    return writeCandidateOutputs(clubs);
  }

  console.log(
    `Probing fuel API for ${unknowns.length} club(s) with unknown gas status (concurrency 5)...`,
  );
  console.log(
    "Note: empty fuel arrays do not clear hasGas; only locator discovery may set hasGas false.",
  );

  const probeResults = await mapPool(unknowns, 5, async (club) => {
    const result = await probeFuelPrice(club.clubNumber);
    return { clubNumber: club.clubNumber, result };
  });

  const byNumber = new Map(probeResults.map((r) => [r.clubNumber, r.result]));
  const updated = clubs.map((club) => {
    if (club.gasStatus !== "unknown") return club;
    const result = byNumber.get(club.clubNumber);
    if (!result) return club;
    if (result.kind === "has_products") {
      return {
        ...club,
        hasGas: true,
        gasStatus: "yes" as const,
        gasClassification: {
          source: "locator" as const,
          signals: [
            ...new Set([...(club.gasClassification?.signals ?? []), "eisapi=has_products"]),
          ],
        },
      };
    }
    return club;
  });

  assertValidOrThrow(validateClubs(updated));
  return writeCandidateOutputs(updated);
}

export async function runFullDiscover(): Promise<DiscoverySummary> {
  const clubs = await discoverClubs();
  assertValidOrThrow(validateClubs(clubs));
  const summary = await writeCandidateOutputs(clubs);
  console.log(
    `Wrote candidate ${summary.totalClubs} clubs (${summary.gasClubs} with gas). Next: pnpm discovery:diff`,
  );
  return summary;
}
