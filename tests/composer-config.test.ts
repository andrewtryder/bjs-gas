import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();

describe("Prisma Composer 0.39 configuration & migration invariants", () => {
  it("uses prisma.composer.config.ts and avoids retired/conflicting config files", () => {
    // Root prisma.config.ts would conflict with Prisma 6 ORM commands (AGENTS.md).
    expect(fs.existsSync(path.join(rootDir, "prisma.config.ts"))).toBe(false);
    // Retired Composer 0.18 config file triggers CONFIG.FILE_RETIRED in 0.39.
    expect(fs.existsSync(path.join(rootDir, "prisma-composer.config.ts"))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, "prisma.composer.config.ts"))).toBe(true);

    const composerConfig = fs.readFileSync(path.join(rootDir, "prisma.composer.config.ts"), "utf8");
    expect(composerConfig).toContain("$prismaConfig: 1");
    expect(composerConfig).toContain('region: "us-east-1"');
    expect(composerConfig).toContain('entry: "./module.ts"');
    expect(composerConfig).toContain("prismaState()");
  });

  it("preserves stable provision IDs and secret bindings in module.ts", () => {
    const moduleSource = fs.readFileSync(path.join(rootDir, "module.ts"), "utf8");
    expect(moduleSource).toContain('appRoot("bjs-gas"');
    expect(moduleSource).toContain('rawPostgres({ name: "database" })');
    expect(moduleSource).toContain('id: "bjsgasapi"');
    expect(moduleSource).toContain('id: "bjsgasweb"');
    expect(moduleSource).toContain('id: "scheduler"');
    expect(moduleSource).toContain('envSecret("COLLECTOR_SECRET")');
    expect(moduleSource).toContain('envSecret("HONEYBADGER_API_KEY")');
    expect(moduleSource).toContain('envSecret("CARTO_API_KEY")');
    expect(moduleSource).not.toContain('envSecret("DATABASE_URL")');
    expect(moduleSource).not.toContain('envSecret("DATABASE_URL_POOLED")');
  });

  it("keeps Composer 0.39 runtime pins aligned across package.json and pnpm-workspace.yaml", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    const webPkg = JSON.parse(fs.readFileSync(path.join(rootDir, "web/package.json"), "utf8"));
    const workspaceYaml = fs.readFileSync(path.join(rootDir, "pnpm-workspace.yaml"), "utf8");

    expect(pkg.dependencies["@prisma/composer"]).toBe("0.39.0");
    expect(pkg.dependencies["@prisma/composer-prisma-cloud"]).toBe("0.39.0");
    expect(webPkg.dependencies["@prisma/composer"]).toBe("0.39.0");
    expect(webPkg.dependencies["@prisma/composer-prisma-cloud"]).toBe("0.39.0");

    expect(pkg.dependencies["@prisma/orm-postgres"]).toBe(webPkg.dependencies["@prisma/orm-postgres"]);
    expect(pkg.dependencies.alchemy).toBe("2.0.0-beta.85");
    expect(pkg.dependencies.effect).toBe("4.1.0");

    expect(workspaceYaml).toContain('"@prisma/config>effect": "3.22.1"');
    expect(workspaceYaml).toContain("effect: 4.1.0");
    expect(workspaceYaml).toContain('"@effect/platform-bun": 4.1.0');
    expect(workspaceYaml).toContain('"@effect/platform-node": 4.1.0');
    expect(workspaceYaml).toContain('"@effect/platform-node-shared": 4.1.0');
  });
});
