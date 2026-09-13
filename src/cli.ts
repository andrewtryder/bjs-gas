#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  candidateIsNewerThanAuthoritative,
  runDiscoverClubsOnly,
  runDiscoverGasFromExisting,
  runDiscoveryAccept,
  runDiscoveryDiff,
  runFullDiscover,
} from "./discover.js";
import { disconnectPrisma, getPrisma } from "./db.js";
import { runCollection } from "./collector.js";
import { fetchClubFuel } from "./fuel/client.js";
import { importClubsBulk } from "./persist.js";
import { runSitemapCanary } from "./sitemap-canary.js";
import { coerceClub, type BjsClub } from "./types.js";
import { isAliasedParentClub, loadGasStationAliases } from "./gas-station-alias.js";

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const positionals = argv.filter((a) => !a.startsWith("--"));
  return { flags, positionals };
}

async function importClubs(allowStaleCandidate: boolean): Promise<void> {
  if ((await candidateIsNewerThanAuthoritative()) && !allowStaleCandidate) {
    throw new Error(
      "A newer data/clubs.candidate.json exists that has not been accepted. " +
        "Run: pnpm discovery:diff && pnpm discovery:accept  (or import:clubs -- --allow-stale-candidate)",
    );
  }

  const file = path.join(process.cwd(), "data", "clubs.json");
  const clubs = (JSON.parse(readFileSync(file, "utf8")) as unknown[]).map((c) =>
    coerceClub(c as Parameters<typeof coerceClub>[0]),
  ) as BjsClub[];
  const aliases = loadGasStationAliases();
  const prisma = getPrisma();
  const result = await importClubsBulk(
    prisma,
    clubs.map((c) => ({
      clubNumber: c.clubNumber,
      clubId: c.clubId,
      name: c.name,
      address1: c.address1,
      address2: c.address2 ?? null,
      city: c.city,
      state: c.state,
      postalCode: c.postalCode,
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      phone: c.phone ?? null,
      // Aliased parent warehouse clubs (e.g. #321 Hyannis) cede their gas identity
      // to the canonical dedicated gas station (e.g. #902 Hyannis Gas Station).
      // The physical fuel dispensers are at the dedicated station address.
      hasGas: c.hasGas && !isAliasedParentClub(c.clubNumber, aliases),
      storeType: c.storeType ?? null,
      gasClassification: c.gasClassification ?? null,
      services: c.services ?? [],
      clubUrl: c.clubUrl ?? null,
      source: c.source ?? null,
    })),
  );
  const total = await prisma.club.count();
  const gas = await prisma.club.count({ where: { hasGas: true } });
  console.log(JSON.stringify({ upserted: result.upserted, totalClubs: total, gasClubs: gas }));
}

async function collectClub(clubNumber: number, persist: boolean): Promise<void> {
  const startedAt = new Date();
  const observedAt = startedAt.toISOString();
  const result = await fetchClubFuel(clubNumber, observedAt);
  console.log(JSON.stringify(result, null, 2));
  if (persist && result.ok) {
    const finishedAt = new Date();
    const { persistFuelObservations } = await import("./persist.js");
    const stats = await persistFuelObservations(getPrisma(), result.observations, {
      startedAt: observedAt,
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      clubsConfigured: 1,
      clubsSucceeded: 1,
      clubsEmptyFuels: 0,
      clubsHardFailed: 0,
      fuelObservations: result.observations.length,
      degraded: false,
      failures: [],
    });
    console.log(JSON.stringify({ persisted: true, ...stats }));
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "discover";
  const { flags, positionals } = parseArgs(process.argv.slice(3));

  try {
    switch (command) {
      case "discover": {
        console.log(JSON.stringify(await runFullDiscover(), null, 2));
        break;
      }
      case "discover:clubs": {
        console.log(JSON.stringify(await runDiscoverClubsOnly(), null, 2));
        break;
      }
      case "discover:gas": {
        console.log(JSON.stringify(await runDiscoverGasFromExisting(), null, 2));
        break;
      }
      case "discovery:diff": {
        const diff = await runDiscoveryDiff();
        if (!diff.clean) process.exitCode = 1;
        break;
      }
      case "discovery:accept": {
        await runDiscoveryAccept(flags.has("--force"));
        break;
      }
      case "discover:sitemap-canary": {
        const result = await runSitemapCanary();
        console.log(JSON.stringify(result, null, 2));
        if (result.newClubNumbers.length > 0) {
          console.error(
            `ALERT: ${result.newClubNumbers.length} sitemap club ID(s) not in clubs.json: ${result.newClubNumbers.join(", ")}. Run full Playwright discover.`,
          );
          process.exitCode = 1;
        } else {
          console.log(
            `No new sitemap IDs. (${result.sitemapClubCount} SEO vs ${result.knownClubCount} authoritative; ${result.knownButMissingFromSitemap.length} known missing from sitemap — expected, not an alert)`,
          );
        }
        break;
      }
      case "import:clubs": {
        await importClubs(flags.has("--allow-stale-candidate"));
        break;
      }
      case "collect:club": {
        const n = Number.parseInt(positionals[0] ?? "", 10);
        if (!Number.isFinite(n)) {
          throw new Error("Usage: collect:club -- <clubNumber> [--persist]");
        }
        await collectClub(n, flags.has("--persist"));
        break;
      }
      case "collect:once": {
        const dryRun = flags.has("--dry-run");
        const result = await runCollection(
          dryRun ? { dryRun: true } : { dryRun: false, prisma: getPrisma() },
        );
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        console.error(
          "Commands: discover | discover:clubs | discover:gas | discovery:diff | discovery:accept | discover:sitemap-canary | import:clubs | collect:club | collect:once",
        );
        process.exitCode = 1;
    }
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
