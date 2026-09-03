/**
 * Chromium-free discovery investigation probe.
 * Ordinary HTTP only — no Playwright, no cookies, no CAPTCHA bypass.
 *
 * Usage: node scripts/probe-sitemap-discovery.mjs
 * Outputs: data/raw-sitemap-discovery-probe.json (gitignored via data/raw-*.json)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "data", "raw-sitemap-discovery-probe.json");
const CLUBS_PATH = path.join(ROOT, "data", "clubs.json");
const GAS_PATH = path.join(ROOT, "data", "gas-clubs.json");

const UAS = {
  descriptive: "bjs-gas-discovery-research/0.1 (+local investigation)",
  chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};

const CL_RE =
  /https?:\/\/(?:www\.)?bjs\.com\/cl\/([^/?#\s]+)\/(\d+)\/?(?:\?[^\s<#]*)?(?:#[^\s]*)?/gi;

function normalizeClubId(digits) {
  const n = Number.parseInt(String(digits), 10);
  if (!Number.isFinite(n)) throw new Error(`bad club id ${digits}`);
  return String(n).padStart(4, "0");
}

async function probeUrl(url, userAgent, { maxBytes = 2_000_000 } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const text = buf.subarray(0, Math.min(buf.length, maxBytes)).toString("utf8");
    return {
      url,
      userAgentLabel: Object.entries(UAS).find(([, v]) => v === userAgent)?.[0] ?? "custom",
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type"),
      size: buf.length,
      finalUrl: res.url,
      redirected: res.url !== url,
      accessDenied: /access denied/i.test(text),
      durationMs: Date.now() - started,
      bodyPreview: text.slice(0, 240).replace(/\s+/g, " "),
      body: res.ok && !/access denied/i.test(text) ? text : null,
    };
  } catch (error) {
    return {
      url,
      userAgentLabel: Object.entries(UAS).find(([, v]) => v === userAgent)?.[0] ?? "custom",
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
      body: null,
    };
  }
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(xml);
}

function extractClubUrls(text) {
  const byNumber = new Map();
  for (const m of text.matchAll(CL_RE)) {
    const slug = m[1];
    const clubId = normalizeClubId(m[2]);
    const clubNumber = Number.parseInt(clubId, 10);
    const url = `https://www.bjs.com/cl/${slug.toLowerCase()}/${clubId}/`;
    if (!byNumber.has(clubNumber)) {
      byNumber.set(clubNumber, { clubNumber, clubId, slug: slug.toLowerCase(), url });
    }
  }
  return [...byNumber.values()].sort((a, b) => a.clubNumber - b.clubNumber);
}

function analyzeClubHtml(html, clubNumber) {
  const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1].trim(),
  );
  let jsonLdParsed = [];
  for (const block of jsonLdBlocks) {
    try {
      jsonLdParsed.push(JSON.parse(block));
    } catch {
      jsonLdParsed.push({ parseError: true, preview: block.slice(0, 120) });
    }
  }

  const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  let nextDataKeys = null;
  if (nextDataMatch) {
    try {
      const nd = JSON.parse(nextDataMatch[1]);
      nextDataKeys = Object.keys(nd);
    } catch {
      nextDataKeys = ["parse_error"];
    }
  }

  const featureChips = [
    ...html.matchAll(/feature-detail-text[^>]*>([^<]+)</gi),
  ].map((m) => m[1].replace(/&amp;/g, "&").trim());
  const uniqueFeatures = [...new Set(featureChips)];
  const storeTypeMatch = html.match(
    /&q;name&q;:&q;StoreType&q;,&q;value&q;:&q;([^&]+)&q;/,
  );
  const storeType = storeTypeMatch?.[1] ?? null;
  const gasHoursMatch = html.match(
    /&q;name&q;:&q;Gas Hours&q;,&q;value&q;:&q;([^&]*)&q;/,
  );
  const gasHours = (gasHoursMatch?.[1] ?? "").replace(/&l;br&g;/g, " | ").trim();
  const latMatch = html.match(/&q;latitude&q;:&q;([-0-9.]+)&q;/);
  const lngMatch = html.match(/&q;longitude&q;:&q;([-0-9.]+)&q;/);
  const hasGasFeatureChip = uniqueFeatures.includes("Gas");
  const inferredHasGas =
    hasGasFeatureChip || storeType === "GAS" || gasHours.length > 0;

  const fieldHints = {
    name: /WholesaleStore|"displayStoreName"/i.test(html),
    address: /streetAddress|addressLine/i.test(html),
    city: /addressLocality|&q;city&q;/i.test(html),
    state: /addressRegion|stateOrProvinceName/i.test(html),
    postalCode: /postalCode/i.test(html),
    latitude: Boolean(latMatch),
    longitude: Boolean(lngMatch),
    phone: /telephone1|itemprop=["']telephone["']/i.test(html),
    gasFeatureChip: hasGasFeatureChip,
    storeType,
    gasHoursNonEmpty: gasHours.length > 0,
    inferredHasGas,
    hours: /openingHours|Gas Hours|Store Hours/i.test(html),
    features: uniqueFeatures.length > 0 || /Club Features|Specialty Services/i.test(html),
    thinShellSuspect: html.length < 100_000 && !/WholesaleStore/i.test(html),
  };

  return {
    clubNumber,
    htmlBytes: html.length,
    jsonLdBlockCount: jsonLdBlocks.length,
    jsonLdTypes: jsonLdParsed.map((d) => d?.["@type"] ?? null),
    jsonLdAddress: jsonLdParsed.find((d) => d?.address)?.address ?? null,
    hasNextData: Boolean(nextDataMatch),
    nextDataKeys,
    featureChips: uniqueFeatures,
    storeType,
    gasHours: gasHours || null,
    latitude: latMatch?.[1] ?? null,
    longitude: lngMatch?.[1] ?? null,
    fieldHints,
    title: (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim().slice(0, 160),
  };
}

async function probeEisapi(clubNumber) {
  const url = `https://eisapi.bjs.com/api/v1/fuelprice/clubnum/${clubNumber}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UAS.descriptive },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const data = parsed?.response?.fuelPriceResponse?.data;
    return {
      clubNumber,
      httpStatus: res.status,
      statusCode: parsed?.response?.statusCode ?? null,
      statusMsg: parsed?.response?.statusMsg ?? null,
      fuelCount: Array.isArray(data) ? data.length : null,
      fuels: Array.isArray(data)
        ? data.map((f) => ({ name: f.name, sku: f.sku, price: f.price }))
        : null,
      durationMs: Date.now() - started,
      bodyPreview: text.slice(0, 160),
    };
  } catch (error) {
    return {
      clubNumber,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  }
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    runtime: "node-fetch-local",
    note: "No Playwright; no cookies; ordinary User-Agent only.",
    transport: { byUa: {} },
    sitemap: null,
    inventoryDiff: null,
    clubPages: [],
    eisapi: [],
    architectureRanking: null,
    discoverHttpGate: null,
  };

  const primaryUa = UAS.descriptive;
  const seedUrls = [
    "https://www.bjs.com/robots.txt",
    "https://www.bjs.com/bjs_sitemap.xml",
    "https://www.bjs.com/cl/nashua/0039",
    "https://www.bjs.com/cl/haverhill/0189",
    "https://www.bjs.com/cl/auburn/0901",
  ];

  for (const [label, ua] of Object.entries(UAS)) {
    report.transport.byUa[label] = [];
    for (const url of seedUrls) {
      const r = await probeUrl(url, ua);
      const { body: _b, ...meta } = r;
      report.transport.byUa[label].push(meta);
    }
  }

  // Full sitemap walk with descriptive UA
  const robots = await probeUrl("https://www.bjs.com/robots.txt", primaryUa);
  const indexProbe = await probeUrl("https://www.bjs.com/bjs_sitemap.xml", primaryUa, {
    maxBytes: 5_000_000,
  });

  const sitemap = {
    robotsOk: Boolean(robots.ok && robots.body),
    robotsStatus: robots.status,
    robotsMentionsSitemap:
      typeof robots.body === "string" && /Sitemap:\s*https:\/\/www\.bjs\.com\/bjs_sitemap\.xml/i.test(robots.body),
    indexOk: Boolean(indexProbe.ok && indexProbe.body),
    indexStatus: indexProbe.status,
    structure: null,
    childSitemaps: [],
    clubUrls: [],
    uniqueClubCount: 0,
    nodeFetchBlocked: !(indexProbe.ok && indexProbe.body),
  };

  let allXml = "";
  if (indexProbe.body) {
    allXml += indexProbe.body;
    sitemap.structure = isSitemapIndex(indexProbe.body) ? "sitemap_index" : "urlset";
    const childLocs = isSitemapIndex(indexProbe.body) ? extractLocs(indexProbe.body) : [];
    for (const child of childLocs) {
      const childProbe = await probeUrl(child, primaryUa, { maxBytes: 8_000_000 });
      const { body, ...meta } = childProbe;
      sitemap.childSitemaps.push({
        ...meta,
        locCount: body ? extractLocs(body).length : 0,
        clUrlCount: body ? extractClubUrls(body).length : 0,
      });
      if (body) allXml += `\n${body}`;
    }
    if (!isSitemapIndex(indexProbe.body)) {
      sitemap.childSitemaps.push({
        url: indexProbe.url,
        status: indexProbe.status,
        note: "index was a urlset",
        locCount: extractLocs(indexProbe.body).length,
        clUrlCount: extractClubUrls(indexProbe.body).length,
      });
    }
  }

  const clubsFromSitemap = extractClubUrls(allXml);
  sitemap.clubUrls = clubsFromSitemap;
  sitemap.uniqueClubCount = clubsFromSitemap.length;
  report.sitemap = {
    ...sitemap,
    clubUrls: clubsFromSitemap.slice(0, 5), // sample only in summary; full list stored separately
    clubUrlSample: clubsFromSitemap.slice(0, 8),
  };

  // Inventory diff
  const existing = JSON.parse(readFileSync(CLUBS_PATH, "utf8"));
  const gasClubs = JSON.parse(readFileSync(GAS_PATH, "utf8"));
  const existingNums = new Set(existing.map((c) => c.clubNumber));
  const sitemapNums = new Set(clubsFromSitemap.map((c) => c.clubNumber));
  const onlyExisting = [...existingNums].filter((n) => !sitemapNums.has(n)).sort((a, b) => a - b);
  const onlySitemap = [...sitemapNums].filter((n) => !existingNums.has(n)).sort((a, b) => a - b);
  const missingDetails = existing
    .filter((c) => onlyExisting.includes(c.clubNumber))
    .map((c) => ({
      clubNumber: c.clubNumber,
      name: c.name,
      hasGas: c.hasGas,
      clubUrl: c.clubUrl,
    }));

  report.inventoryDiff = {
    existingClubCount: existing.length,
    existingGasCount: gasClubs.length,
    sitemapClubUrlCount: clubsFromSitemap.length,
    sitemapUniqueClubNumbers: sitemapNums.size,
    onlyInExisting: onlyExisting,
    onlyInSitemap: onlySitemap,
    onlyInExistingDetails: missingDetails,
    nodeCouldNotFetchSitemap: sitemap.nodeFetchBlocked,
  };

  // Club pages — only when transport works; still attempt samples
  const pageTargets = [
    { clubNumber: 39, url: "https://www.bjs.com/cl/nashua/0039/" },
    { clubNumber: 189, url: "https://www.bjs.com/cl/haverhill/0189/" },
    { clubNumber: 901, url: "https://www.bjs.com/cl/auburn/0901/" },
    { clubNumber: 11, url: "https://www.bjs.com/cl/e-setauket/0011/" }, // non-gas
    { clubNumber: 580, url: "https://www.bjs.com/cl/uxbridge/0580/" }, // may 404 / missing from sitemap
  ];
  // Prefer slug from sitemap when present
  for (const t of pageTargets) {
    const fromSm = clubsFromSitemap.find((c) => c.clubNumber === t.clubNumber);
    if (fromSm) t.url = fromSm.url;
  }

  for (const t of pageTargets) {
    const page = await probeUrl(t.url, primaryUa, { maxBytes: 3_000_000 });
    if (page.body) {
      report.clubPages.push({
        ...t,
        fetch: { status: page.status, ok: page.ok, size: page.size, accessDenied: page.accessDenied },
        analysis: analyzeClubHtml(page.body, t.clubNumber),
      });
    } else {
      report.clubPages.push({
        ...t,
        fetch: {
          status: page.status,
          ok: page.ok,
          size: page.size,
          accessDenied: page.accessDenied,
          error: page.error,
          bodyPreview: page.bodyPreview,
        },
        analysis: null,
        note: "Page body unavailable from local Node fetch",
      });
    }
  }

  // eisapi bounded samples
  const eisapiTargets = [
    { clubNumber: 189, label: "known_gas_with_prices" },
    { clubNumber: 39, label: "known_gas_with_prices" },
    { clubNumber: 901, label: "gas_listed_often_empty_fuels" },
    { clubNumber: 255, label: "gas_listed_often_empty_fuels" },
    { clubNumber: 11, label: "known_non_gas" },
    { clubNumber: 17, label: "known_non_gas" },
    { clubNumber: 580, label: "distribution_center_non_gas" },
    { clubNumber: 99999, label: "invalid_club_number" },
  ];
  for (const t of eisapiTargets) {
    const result = await probeEisapi(t.clubNumber);
    report.eisapi.push({ ...t, ...result });
  }

  const pagesOk = report.clubPages.some((p) => p.analysis);
  const sitemapOk = !sitemap.nodeFetchBlocked && sitemap.uniqueClubCount > 0;

  report.architectureRanking = [
    {
      rank: 1,
      id: "C",
      name: "sitemap + club pages for metadata/hasGas + eisapi soft verify only",
      reliableForInventory: sitemapOk && onlyExisting.length === 0,
      reliableForHasGas: pagesOk,
      notes:
        "Best design IF pages and complete sitemap are reachable. Empty eisapi fuels must not clear hasGas. Inventory incomplete when sitemap ⊂ clubs.json.",
    },
    {
      rank: 2,
      id: "A",
      name: "sitemap → club page Features contains Gas",
      reliableForInventory: sitemapOk && onlyExisting.length === 0,
      reliableForHasGas: pagesOk,
      notes: "Same inventory + page-fetch dependencies as C; no soft fuel verify.",
    },
    {
      rank: 3,
      id: "B",
      name: "sitemap → eisapi fuel endpoint for gas classification",
      reliableForInventory: sitemapOk && onlyExisting.length === 0,
      reliableForHasGas: false,
      notes:
        "REJECT as sole classifier: gas clubs (e.g. 901) often return success with empty data[]; transient failures must not imply no gas.",
    },
  ];

  const gatePass = sitemapOk && pagesOk && onlyExisting.length === 0;
  report.discoverHttpGate = {
    implementDiscoverHttp: gatePass,
    reasons: [
      sitemap.nodeFetchBlocked
        ? "Local Node cannot fetch www.bjs.com sitemap (Akamai 403)"
        : "Sitemap fetch succeeded from local Node",
      pagesOk
        ? "At least one club page returned analyzable HTML"
        : "Club pages not fetchable from local Node",
      onlyExisting.length > 0
        ? `Sitemap incomplete vs clubs.json: missing ${onlyExisting.length} IDs (${onlyExisting.join(",")})`
        : "Sitemap club set covers all existing clubs.json IDs",
    ],
    decision: gatePass
      ? "Add pnpm discover:http experimental command"
      : "Do NOT add discover:http; keep Playwright discovery; document findings",
  };

  // Persist full club URL list alongside report
  const fullOut = {
    ...report,
    sitemapClubsFull: clubsFromSitemap,
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(fullOut, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    wrote: OUT,
    transportDescriptiveRobots: report.transport.byUa.descriptive?.[0]?.status,
    transportDescriptiveSitemap: report.transport.byUa.descriptive?.[1]?.status,
    sitemapUnique: sitemap.uniqueClubCount,
    onlyInExisting: onlyExisting.length,
    pagesAnalyzed: report.clubPages.filter((p) => p.analysis).length,
    discoverHttpGate: report.discoverHttpGate.implementDiscoverHttp,
    decision: report.discoverHttpGate.decision,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
