/**
 * Cloudflare Cron trigger — schedules only.
 * No Prisma, no Postgres, no BJ's HTTP.
 */
export interface Env {
  COLLECTOR_SECRET: string;
  PRISMA_COLLECT_URL: string;
}

async function triggerCollect(env: Env): Promise<{ status: number; durationMs: number; body: string }> {
  const started = Date.now();
  const response = await fetch(env.PRISMA_COLLECT_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.COLLECTOR_SECRET}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(290_000),
  });
  const body = await response.text();
  return { status: response.status, durationMs: Date.now() - started, body: body.slice(0, 2000) };
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const result = await triggerCollect(env);
          console.log(
            JSON.stringify({
              event: "prisma_collection_trigger",
              status: result.status,
              durationMs: result.durationMs,
              bodyPreview: result.body.slice(0, 500),
            }),
          );
        } catch (error) {
          console.error(
            JSON.stringify({
              event: "prisma_collection_trigger_error",
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      })(),
    );
  },

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        ok: true,
        service: "bjs-gas-trigger",
        role: "cloudflare-cron-only",
      });
    }
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
