/**
 * Sitemap change detector (canary) — NOT authoritative discovery.
 * Alerts when SEO /cl/ IDs appear that are missing from data/clubs.json.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { coerceClub, type BjsClub } from "./types.js";
import { normalizeClubId, normalizeClubNumber } from "./normalize.js";

const UA = "bjs-gas-sitemap-canary/0.1 (+change detector; not a crawler for indexing)";
const CL_RE =
  /https?:\/\/(?:www\.)?bjs\.com\/cl\/([^/?#\s]+)\/(\d+)\/?(?:\?[^\s<#]*)?(?:#[^\s]*)?/gi;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "application/xml,text/xml,text/html,*/*",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  return res.text();
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!.trim());
}

function extractClubNumbers(text: string): number[] {
  const nums = new Set<number>();
  for (const m of text.matchAll(CL_RE)) {
    nums.add(normalizeClubNumber(normalizeClubId(m[2]!)));
  }
  return [...nums].sort((a, b) => a - b);
}

export type SitemapCanaryResult = {
  sitemapClubCount: number;
  knownClubCount: number;
  newClubNumbers: number[];
  knownButMissingFromSitemap: number[];
};

export async function runSitemapCanary(
  clubsPath = path.join(process.cwd(), "data", "clubs.json"),
): Promise<SitemapCanaryResult> {
  const known = (JSON.parse(readFileSync(clubsPath, "utf8")) as unknown[]).map((c) =>
    coerceClub(c as Parameters<typeof coerceClub>[0]),
  ) as BjsClub[];
  const knownSet = new Set(known.map((c) => c.clubNumber));

  const indexXml = await fetchText("https://www.bjs.com/bjs_sitemap.xml");
  const childLocs = extractLocs(indexXml);
  let blob = indexXml;
  for (const child of childLocs) {
    blob += `\n${await fetchText(child)}`;
  }

  const sitemapNums = extractClubNumbers(blob);
  const sitemapSet = new Set(sitemapNums);
  const newClubNumbers = sitemapNums.filter((n) => !knownSet.has(n));
  const knownButMissingFromSitemap = [...knownSet]
    .filter((n) => !sitemapSet.has(n))
    .sort((a, b) => a - b);

  return {
    sitemapClubCount: sitemapNums.length,
    knownClubCount: known.length,
    newClubNumbers,
    knownButMissingFromSitemap,
  };
}
