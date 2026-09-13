import { describe, expect, it } from "vitest";
import {
  validateAliasMap,
  canonicalizeGasClubs,
  getUpstreamFuelFeedClub,
  getCanonicalGasClub,
  isAliasedParentClub,
  AliasValidationError,
} from "../src/gas-station-alias.js";

const CANONICAL_ALIASES: Record<string, number> = {
  "38": 901,
  "55": 905,
  "60": 903,
  "69": 898,
  "208": 900,
  "321": 902,
  "353": 899,
};

describe("validateAliasMap", () => {
  it("accepts valid, well-formed alias map", () => {
    const validated = validateAliasMap(CANONICAL_ALIASES);
    expect(validated[321]).toBe(902);
    expect(validated[60]).toBe(903);
    expect(Object.keys(validated).length).toBe(7);
  });

  it("rejects self-aliases (A -> A)", () => {
    expect(() => validateAliasMap({ "100": 100 })).toThrow(AliasValidationError);
    expect(() => validateAliasMap({ "100": 100 })).toThrow(/Self-alias rejected/);
  });

  it("rejects cycles (A -> B -> A)", () => {
    expect(() => validateAliasMap({ "100": 200, "200": 100 })).toThrow(AliasValidationError);
    expect(() => validateAliasMap({ "100": 200, "200": 100 })).toThrow(/cycle/i);
  });

  it("rejects invalid (non-positive) source numbers", () => {
    expect(() => validateAliasMap({ "0": 100 })).toThrow(AliasValidationError);
    expect(() => validateAliasMap({ "-5": 100 })).toThrow(AliasValidationError);
  });

  it("rejects invalid (non-positive) target numbers", () => {
    expect(() => validateAliasMap({ "100": 0 })).toThrow(AliasValidationError);
  });

  it("validates known clubs when knownClubs set is provided", () => {
    const knownClubs = new Set([901, 902, 903, 898, 899, 900, 905]);
    // Should not throw - all targets exist
    expect(() => validateAliasMap(CANONICAL_ALIASES, knownClubs)).not.toThrow();

    // Should throw - target 999 not in known clubs
    expect(() => validateAliasMap({ "100": 999 }, knownClubs)).toThrow(AliasValidationError);
    expect(() => validateAliasMap({ "100": 999 }, knownClubs)).toThrow(/does not exist/);
  });

  it("accepts the canonical production aliases", () => {
    const validated = validateAliasMap(CANONICAL_ALIASES);
    expect(validated).toEqual({
      38: 901,
      55: 905,
      60: 903,
      69: 898,
      208: 900,
      321: 902,
      353: 899,
    });
  });
});

describe("canonicalizeGasClubs", () => {
  const mockClubs = [
    { clubNumber: 38, name: "Auburn" },
    { clubNumber: 60, name: "Columbia" },
    { clubNumber: 100, name: "Other Station" },
    { clubNumber: 321, name: "Hyannis" },
    { clubNumber: 353, name: "Quincy" },
    { clubNumber: 898, name: "Fredericksburg Gas Station" },
    { clubNumber: 899, name: "Quincy Gas Station" },
    { clubNumber: 901, name: "Auburn Gas Station" },
    { clubNumber: 902, name: "Hyannis Gas Station" },
    { clubNumber: 903, name: "Columbia Gas Station" },
  ];

  it("removes aliased parent warehouse clubs", () => {
    const result = canonicalizeGasClubs(mockClubs, CANONICAL_ALIASES);
    const clubNumbers = result.map((c) => c.clubNumber);
    expect(clubNumbers).not.toContain(38);  // aliased parent
    expect(clubNumbers).not.toContain(60);  // aliased parent
    expect(clubNumbers).not.toContain(321); // aliased parent
    expect(clubNumbers).not.toContain(353); // aliased parent
  });

  it("retains canonical dedicated gas stations", () => {
    const result = canonicalizeGasClubs(mockClubs, CANONICAL_ALIASES);
    const clubNumbers = result.map((c) => c.clubNumber);
    expect(clubNumbers).toContain(898);
    expect(clubNumbers).toContain(899);
    expect(clubNumbers).toContain(901);
    expect(clubNumbers).toContain(902);
    expect(clubNumbers).toContain(903);
  });

  it("retains unrelated stations", () => {
    const result = canonicalizeGasClubs(mockClubs, CANONICAL_ALIASES);
    const clubNumbers = result.map((c) => c.clubNumber);
    expect(clubNumbers).toContain(100);
  });

  it("is pure and deterministic — does not mutate input", () => {
    const original = [...mockClubs];
    canonicalizeGasClubs(mockClubs, CANONICAL_ALIASES);
    expect(mockClubs).toEqual(original);
  });

  it("Hyannis regression: returns only #902 for Hyannis location", () => {
    const hyannis = [
      { clubNumber: 321, name: "Hyannis" },
      { clubNumber: 902, name: "Hyannis Gas Station" },
    ];
    const result = canonicalizeGasClubs(hyannis, CANONICAL_ALIASES);
    expect(result.map((c) => c.clubNumber)).toEqual([902]);
  });

  it("Columbia regression: returns only #903 for Columbia location", () => {
    const columbia = [
      { clubNumber: 60, name: "Columbia" },
      { clubNumber: 903, name: "Columbia Gas Station" },
    ];
    const result = canonicalizeGasClubs(columbia, CANONICAL_ALIASES);
    expect(result.map((c) => c.clubNumber)).toEqual([903]);
  });

  it("does NOT deduplicate unrelated same-city stations", () => {
    // Club 100 and 101 happen to be in the same city but are NOT aliases
    const unrelated = [
      { clubNumber: 100, name: "Dedham" },
      { clubNumber: 101, name: "Dedham #2" },
    ];
    const result = canonicalizeGasClubs(unrelated, CANONICAL_ALIASES);
    expect(result.map((c) => c.clubNumber).sort()).toEqual([100, 101]);
  });

  it("returns all clubs unchanged when aliases is empty", () => {
    const result = canonicalizeGasClubs(mockClubs, {});
    expect(result).toEqual(mockClubs);
  });
});

describe("getUpstreamFuelFeedClub", () => {
  it("returns parent feed club for canonical dedicated station", () => {
    expect(getUpstreamFuelFeedClub(902, CANONICAL_ALIASES)).toBe(321);
    expect(getUpstreamFuelFeedClub(903, CANONICAL_ALIASES)).toBe(60);
    expect(getUpstreamFuelFeedClub(898, CANONICAL_ALIASES)).toBe(69);
    expect(getUpstreamFuelFeedClub(899, CANONICAL_ALIASES)).toBe(353);
    expect(getUpstreamFuelFeedClub(900, CANONICAL_ALIASES)).toBe(208);
    expect(getUpstreamFuelFeedClub(901, CANONICAL_ALIASES)).toBe(38);
    expect(getUpstreamFuelFeedClub(905, CANONICAL_ALIASES)).toBe(55);
  });

  it("returns clubNumber itself for unrelated stations", () => {
    expect(getUpstreamFuelFeedClub(1, CANONICAL_ALIASES)).toBe(1);
    expect(getUpstreamFuelFeedClub(100, CANONICAL_ALIASES)).toBe(100);
    expect(getUpstreamFuelFeedClub(904, CANONICAL_ALIASES)).toBe(904); // Norwood standalone
  });

  it("returns clubNumber itself for aliased parent (parent is not in reverse lookup)", () => {
    // Parent club 321 should NOT be in the gas-clubs list, but if called it returns itself
    expect(getUpstreamFuelFeedClub(321, CANONICAL_ALIASES)).toBe(321);
    expect(getUpstreamFuelFeedClub(60, CANONICAL_ALIASES)).toBe(60);
  });
});

describe("getCanonicalGasClub", () => {
  it("maps aliased parent to canonical dedicated station", () => {
    expect(getCanonicalGasClub(321, CANONICAL_ALIASES)).toBe(902);
    expect(getCanonicalGasClub(60, CANONICAL_ALIASES)).toBe(903);
    expect(getCanonicalGasClub(69, CANONICAL_ALIASES)).toBe(898);
  });

  it("returns clubNumber unchanged for canonical dedicated and unrelated stations", () => {
    expect(getCanonicalGasClub(902, CANONICAL_ALIASES)).toBe(902);
    expect(getCanonicalGasClub(903, CANONICAL_ALIASES)).toBe(903);
    expect(getCanonicalGasClub(100, CANONICAL_ALIASES)).toBe(100);
    expect(getCanonicalGasClub(904, CANONICAL_ALIASES)).toBe(904);
  });
});

describe("isAliasedParentClub", () => {
  it("returns true for aliased parent warehouse clubs", () => {
    expect(isAliasedParentClub(321, CANONICAL_ALIASES)).toBe(true);
    expect(isAliasedParentClub(60, CANONICAL_ALIASES)).toBe(true);
    expect(isAliasedParentClub(38, CANONICAL_ALIASES)).toBe(true);
  });

  it("returns false for canonical dedicated stations and unrelated clubs", () => {
    expect(isAliasedParentClub(902, CANONICAL_ALIASES)).toBe(false);
    expect(isAliasedParentClub(903, CANONICAL_ALIASES)).toBe(false);
    expect(isAliasedParentClub(904, CANONICAL_ALIASES)).toBe(false); // Norwood standalone
    expect(isAliasedParentClub(100, CANONICAL_ALIASES)).toBe(false);
  });
});

describe("gas-station-aliases.json fixture integrity", () => {
  it("canonical production aliases pass validation without errors", () => {
    expect(() => validateAliasMap(CANONICAL_ALIASES)).not.toThrow();
  });

  it("canonical aliases contain exactly 7 pairs (898-905 minus Norwood #904)", () => {
    const validated = validateAliasMap(CANONICAL_ALIASES);
    expect(Object.keys(validated).length).toBe(7);
  });

  it("all alias targets are in the dedicated gas station series (898-905)", () => {
    const validated = validateAliasMap(CANONICAL_ALIASES);
    for (const target of Object.values(validated)) {
      expect(target).toBeGreaterThanOrEqual(898);
      expect(target).toBeLessThanOrEqual(905);
    }
  });

  it("Norwood #904 is NOT in the alias map (standalone station)", () => {
    const validated = validateAliasMap(CANONICAL_ALIASES);
    // 904 should not appear as any target
    expect(Object.values(validated)).not.toContain(904);
    // Nor should anything map to Norwood
    expect(getUpstreamFuelFeedClub(904, validated)).toBe(904);
  });
});
