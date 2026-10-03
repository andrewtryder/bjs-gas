import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copyPrismaEngine, ENGINE_NAME, findEngine } from "../scripts/copy-prisma-engine.mjs";

describe("Prisma Query Engine Resolution & Build Packaging", () => {
  it("deterministically resolves the Debian OpenSSL query engine binary", () => {
    const enginePath = findEngine();
    expect(enginePath).toContain(ENGINE_NAME);
    expect(fs.existsSync(enginePath)).toBe(true);
    expect(fs.statSync(enginePath).size).toBeGreaterThan(100_000);
  });

  it("copies engine binary to a destination directory and verifies integrity", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bjs-gas-engine-test-"));
    try {
      const dest = copyPrismaEngine(tmpDir);
      expect(fs.existsSync(dest)).toBe(true);
      expect(fs.statSync(dest).size).toBeGreaterThan(100_000);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
