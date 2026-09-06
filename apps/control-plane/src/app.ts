import { Hono } from "hono";
import { createDb, type Database } from "./db/client";
import type { Env } from "./env";
import { notFound, onError } from "./helpers/errors";
import { observabilityFromEnv, type ObservabilityClient } from "./helpers/observability";
import { requestIdMiddleware, secureHeadersMiddleware } from "./middleware";
import { routes } from "./routes";

export type AppOverrides = {
  // Injected directly in tests; in production each request builds its own
  // db from the D1 binding, since the binding only exists per-request.
  db?: Database;
  // Injected in tests as a fake, or as `null` to exercise the not-configured
  // path. In production it's built per-request from the Cloudflare API bindings.
  observability?: ObservabilityClient | null;
};

export function createApp(overrides: AppOverrides = {}) {
  const app = new Hono<Env>();

  app.use("*", requestIdMiddleware);
  app.use("*", secureHeadersMiddleware);
  app.use("*", async (c, next) => {
    c.set("db", overrides.db ?? createDb(c.env.DB));
    c.set(
      "observability",
      "observability" in overrides
        ? (overrides.observability ?? null)
        : observabilityFromEnv(c.env),
    );
    await next();
  });

  // Keep the routed app's type on the return value — the dashboard derives its
  // typed RPC client (`hc<AppType>()`) from it, so the route/response types have
  // to survive `.route()` rather than being widened away.
  const routedApp = app.route("/v1", routes());

  routedApp.notFound(notFound);
  routedApp.onError(onError);

  return routedApp;
}

export type AppType = ReturnType<typeof createApp>;
