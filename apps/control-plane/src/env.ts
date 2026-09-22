import type { D1Database } from "@cloudflare/workers-types";
import type { JWTPayload } from "hono/utils/jwt/types";
import type { Database } from "./db/client";
import type { Project } from "./db/schema";
import type { Logger } from "./helpers/logger";

export type Bindings = {
  DB: D1Database;
  // Cloudflare Access: the Zero Trust team subdomain and the control-plane
  // application's AUD tag. When both are set the Worker verifies the
  // `Cf-Access-Jwt-Assertion` header on every `/v1` request except `/v1/health`
  // (ADR-0005, P6-03); when either is absent it runs ungated, for local
  // `alchemy dev`. Plain bindings, not secrets — on deploy `CF_ACCESS_AUD` comes
  // from the Access application resource and `CF_ACCESS_TEAM_DOMAIN` from deploy
  // config (ADR-0009).
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  // The dashboard's own origin, for CORS on `/v1/*` (the dashboard is a
  // client-rendered SPA calling this API cross-origin from the browser).
  // Empty/absent means unrestricted — local `alchemy dev`'s dashboard runs on
  // an unpredictable vite port, and nothing is enforced locally either way.
  DASHBOARD_ORIGIN?: string;
};

export type Variables = {
  db: Database;
  project: Project;
  // Set by `requestIdMiddleware` (hono/request-id); also on `X-Request-Id`.
  requestId: string;
  // Request-scoped structured logger, bound to `requestId`, set by
  // `loggerMiddleware`. See `helpers/logger.ts`.
  logger: Logger;
  // The verified Access JWT claims, set by the Access middleware (P6-03). Absent
  // when the Worker runs ungated (no `CF_ACCESS_*` bindings) or on `/v1/health`.
  accessJwt?: JWTPayload;
};

export type Env = { Bindings: Bindings; Variables: Variables };
