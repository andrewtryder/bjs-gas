import { mkdir, readFile, writeFile } from "node:fs/promises";
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
import { assertValidOrThrow, buildSummary, validateClubs } from "./validate.js";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const CLUBS_PATH = path.join(DATA_DIR, "clubs.json");
const GAS_CLUBS_PATH = path.join(DATA_DIR, "gas-clubs.json");
const SUMMARY_PATH = path.join(DATA_DIR, "discovery-summary.json");

const DISCOVERY_METHOD =
  "POST club/search/10201 with large US-radius body via headless Chrome (Playwright persistent profile)";

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

export async function writeClubOutputs(
  clubs: BjsClub[],
  summaryExtras?: Partial<DiscoverySummary>,
): Promise<DiscoverySummary> {
  await ensureDataDir();
  const sorted = [...clubs].sort((a, b) => a.clubNumber - b.clubNumber);
  const gasClubs = sorted.filter((c) => c.hasGas && c.gasStatus === "yes");

  const summary = {
    ...buildSummary(sorted, DISCOVERY_METHOD, [CLUB_SEARCH_URL, STATE_TOWNS_URL]),
    ...summaryExtras,
  };

  await writeJson(CLUBS_PATH, sorted);
  await writeJson(GAS_CLUBS_PATH, gasClubs);
  await writeJson(SUMMARY_PATH, summary);

  return summary;
}

export async function runDiscoverClubsOnly(): Promise<DiscoverySummary> {
  const clubs = await discoverClubs();
  // Location discovery can leave gas unknown; still validate structure.
  assertValidOrThrow(validateClubs(clubs, { requireKnownGas: false }));
  return writeClubOutputs(clubs);
}

export async function runDiscoverGasFromExisting(): Promise<DiscoverySummary> {
  const raw = await readFile(CLUBS_PATH, "utf8");
  const clubs = JSON.parse(raw) as BjsClub[];
  if (!Array.isArray(clubs) || clubs.length === 0) {
    throw new Error(`No clubs found in ${CLUBS_PATH}; run discover:clubs first`);
  }

  const unknowns = clubs.filter((c) => c.gasStatus === "unknown");
  if (unknowns.length === 0) {
    assertValidOrThrow(validateClubs(clubs));
    return writeClubOutputs(clubs);
  }

  console.log(
    `Probing fuel API for ${unknowns.length} club(s) with unknown gas status (concurrency 5)...`,
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
      return { ...club, hasGas: true, gasStatus: "yes" as const };
    }
    // empty_products is inconclusive (standalone GAS stations often empty);
    // transient errors must remain unknown.
    return club;
  });

  assertValidOrThrow(validateClubs(updated));
  return writeClubOutputs(updated);
}

export async function runFullDiscover(): Promise<DiscoverySummary> {
  const clubs = await discoverClubs();
  assertValidOrThrow(validateClubs(clubs));
  const summary = await writeClubOutputs(clubs);
  console.log(
    `Wrote ${summary.totalClubs} clubs (${summary.gasClubs} with gas) to data/`,
  );
  return summary;
}
