/**
 * Skills-only config for `@prisma/cli@8.0.0-rc.19`.
 *
 * Do **not** rename this to `prisma.config.ts`. Prisma Client 6 (`pnpm prisma generate`)
 * auto-loads that filename and rejects this CLI 8 marker. Composer deploy continues to
 * use `prisma-composer.config.ts` + `module.ts`.
 *
 * `$prismaConfig: 1` is the CLI 8 version marker (`definePrismaConfig`).
 * `agents: ["agents"]` syncs only `.agents/skills`.
 *
 * Use: `pnpm skills:sync`
 * Unconfigured `pnpm dlx @prisma/cli@8.0.0-rc.19 skills sync` still defaults to all harnesses.
 */
export default {
  $prismaConfig: 1,
  skills: {
    agents: ["agents"],
  },
};
