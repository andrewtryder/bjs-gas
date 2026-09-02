import type { PhysicalStore } from "./schemas.js";
import type { BjsClub, GasStatus } from "./types.js";

const CLUB_ID_WIDTH = 4;

export function normalizeClubId(raw: string | number): string {
  const digits = String(raw).trim().replace(/\D/g, "");
  if (!digits) {
    throw new Error(`Invalid club id: ${String(raw)}`);
  }
  return digits.padStart(CLUB_ID_WIDTH, "0");
}

export function normalizeClubNumber(raw: string | number): number {
  const id = normalizeClubId(raw);
  return Number.parseInt(id, 10);
}

export function dedupeClubsByNumber(clubs: BjsClub[]): BjsClub[] {
  const byNumber = new Map<number, BjsClub>();
  for (const club of clubs) {
    const existing = byNumber.get(club.clubNumber);
    if (!existing) {
      byNumber.set(club.clubNumber, club);
      continue;
    }
    byNumber.set(club.clubNumber, mergeClub(existing, club));
  }
  return [...byNumber.values()].sort((a, b) => a.clubNumber - b.clubNumber);
}

function mergeClub(a: BjsClub, b: BjsClub): BjsClub {
  const prefer = (left: string | null | undefined, right: string | null | undefined) =>
    left && left.length > 0 ? left : (right ?? left ?? null);

  const services = [...new Set([...a.services, ...b.services])].sort();
  const gasStatus = resolveMergedGasStatus(a.gasStatus, b.gasStatus);

  return {
    clubNumber: a.clubNumber,
    clubId: a.clubId,
    name: prefer(a.name, b.name) ?? a.name,
    city: prefer(a.city, b.city) ?? a.city,
    state: prefer(a.state, b.state) ?? a.state,
    postalCode: prefer(a.postalCode, b.postalCode) ?? a.postalCode,
    address1: prefer(a.address1, b.address1) ?? a.address1,
    address2: prefer(a.address2, b.address2),
    latitude: a.latitude ?? b.latitude ?? null,
    longitude: a.longitude ?? b.longitude ?? null,
    phone: prefer(a.phone, b.phone),
    services,
    hasGas: gasStatus === "yes",
    gasStatus,
    clubUrl: prefer(a.clubUrl, b.clubUrl),
    source: a.source === b.source ? a.source : `${a.source}|${b.source}`,
  };
}

function resolveMergedGasStatus(a: GasStatus, b: GasStatus): GasStatus {
  if (a === "yes" || b === "yes") return "yes";
  if (a === "no" && b === "no") return "no";
  if (a === "no" || b === "no") {
    // Prefer explicit no over unknown only when both agree elsewhere; unknown stays if other is unknown
    return a === "unknown" || b === "unknown" ? "unknown" : "no";
  }
  return "unknown";
}

function attrMap(store: PhysicalStore): Map<string, { value?: string; displayValue?: string }> {
  const map = new Map<string, { value?: string; displayValue?: string }>();
  for (const attr of store.Attribute ?? []) {
    if (!attr.name) continue;
    const entry: { value?: string; displayValue?: string } = {};
    if (attr.value !== undefined) entry.value = attr.value;
    if (attr.displayValue !== undefined) entry.displayValue = attr.displayValue;
    map.set(attr.name, entry);
  }
  return map;
}

function preferredAttrText(
  attrs: Map<string, { value?: string; displayValue?: string }>,
  name: string,
): string {
  const attr = attrs.get(name);
  if (!attr) return "";
  const display = attr.displayValue?.trim() ?? "";
  const value = attr.value?.trim() ?? "";
  // Features.value is often truncated; prefer the longer usable string.
  if (name === "Features") {
    return display.length >= value.length ? display : value;
  }
  return display || value;
}

export function parseServices(featuresText: string): string[] {
  if (!featuresText.trim()) return [];
  return [
    ...new Set(
      featuresText
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ].sort();
}

export function determineGasStatus(input: {
  services: string[];
  storeType: string;
  gasHours: string;
  name: string;
}): GasStatus {
  const { services, storeType, gasHours, name } = input;
  if (services.includes("Gas") || services.includes("Diesel")) return "yes";
  if (storeType.toUpperCase() === "GAS") return "yes";
  if (gasHours.trim().length > 0) return "yes";
  if (/gas\s*station/i.test(name)) return "yes";
  // Locator returned usable feature metadata without Gas ⇒ confirmed no.
  if (services.length > 0 || storeType.toUpperCase() === "CLUB") return "no";
  // Distribution centers and other non-retail sites are not gas locations.
  if (storeType.toUpperCase() === "DC" || /distribution\s+center/i.test(name)) {
    return "no";
  }
  return "unknown";
}

function parseCoord(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

function cleanPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizePhysicalStore(
  store: PhysicalStore,
  source: string,
): BjsClub {
  const clubId = normalizeClubId(store.storeName);
  const clubNumber = normalizeClubNumber(clubId);
  const attrs = attrMap(store);
  const featuresText = preferredAttrText(attrs, "Features");
  const services = parseServices(featuresText);
  const storeType = preferredAttrText(attrs, "StoreType");
  const gasHours = preferredAttrText(attrs, "Gas Hours");
  const name =
    store.Description?.[0]?.displayStoreName?.trim() ||
    store.city?.trim() ||
    `Club ${clubId}`;
  const gasStatus = determineGasStatus({
    services,
    storeType,
    gasHours,
    name,
  });

  const addressLines = (store.addressLine ?? []).map((line) => line.trim()).filter(Boolean);
  const address1 = addressLines[0] ?? "";
  const address2 = addressLines.length > 1 ? addressLines.slice(1).join(", ") : null;

  return {
    clubNumber,
    clubId,
    name,
    city: store.city?.trim() ?? "",
    state: store.stateOrProvinceName?.trim() ?? "",
    postalCode: store.postalCode?.trim() ?? "",
    address1,
    address2,
    latitude: parseCoord(store.latitude),
    longitude: parseCoord(store.longitude),
    phone: cleanPhone(store.telephone1),
    services,
    hasGas: gasStatus === "yes",
    gasStatus,
    clubUrl: `https://www.bjs.com/club/${clubId}`,
    source,
  };
}

export function parseFuelHasProducts(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    throw new Error("Malformed fuel response: not an object");
  }
  const response = (payload as { response?: unknown }).response;
  if (!response || typeof response !== "object") {
    throw new Error("Malformed fuel response: missing response");
  }
  const fuel = (response as { fuelPriceResponse?: { data?: unknown } }).fuelPriceResponse;
  if (!fuel || !Array.isArray(fuel.data)) {
    throw new Error("Malformed fuel response: missing fuelPriceResponse.data");
  }
  return fuel.data.length > 0;
}
