import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { createDb, type Database } from "./db/client";
import type { Env } from "./env";
import { notFound, onError } from "./helpers/errors";
import { loggerMiddleware, requestIdMiddleware, secureHeadersMiddleware } from "./middleware";
import {
  accessJwtConfigFromEnv,
  createAccessJwtMiddleware,
  type AccessJwtConfig,
} from "./middleware/accessJwt";
import { routes } from "./routes";

export type AppOverrides = {
  // Injected directly in tests; in production each request builds its own
  // db from the D1 binding, since the binding only exists per-request.
  db?: Database;
  // Injected in tests (with `keys`), or `null` to force the Access gate off.
  // Absent → built from the `CF_ACCESS_*` bindings; null when they're unset.
  accessJwt?: AccessJwtConfig | null;
};

export function createApp(overrides: AppOverrides = {}) {
  const app = new Hono<Env>();

  app.use("*", requestIdMiddleware);
  app.use("*", loggerMiddleware);
  app.use("*", secureHeadersMiddleware);

  // Cloudflare Access perimeter (ADR-0005, P6-03). Verifies the edge-supplied
  // JWT server-side on every `/v1` request except the health probe. The gate is
  // built once per isolate: injected config in tests, the `CF_ACCESS_*` bindings
  // in production, or absent (ungated) for local `alchemy dev`.
  const HEALTH_PATH = "/v1/health";
  let accessGate: MiddlewareHandler<Env> | null = null;
  let accessGateBuilt = false;
  app.use("/v1/*", async (c, next) => {
    if (c.req.path === HEALTH_PATH) return next();
    if (!accessGateBuilt) {
      const cfg = "accessJwt" in overrides ? overrides.accessJwt : accessJwtConfigFromEnv(c.env);
      accessGate = cfg ? createAccessJwtMiddleware(cfg) : null;
      accessGateBuilt = true;
    }
    return accessGate ? accessGate(c, next) : next();
  });

  app.use("*", async (c, next) => {
    c.set("db", overrides.db ?? createDb(c.env.DB));
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
