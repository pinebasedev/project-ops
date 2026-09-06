import type { D1Database } from "@cloudflare/workers-types";
import type { JWTPayload } from "hono/utils/jwt/types";
import type { Database } from "./db/client";
import type { Project } from "./db/schema";
import type { ObservabilityClient } from "./helpers/observability";

export type Bindings = {
  DB: D1Database;
  // Cloudflare API token + account, used only to query the Workers Observability
  // Telemetry API for an Environment's recent errors (ADR-0004). Optional: the
  // errors route degrades to a "not configured" response when either is absent.
  // The token is a plain `.dev.vars` string locally and a Secrets Store binding
  // (read with `.get()`, see `helpers/secrets.ts`) when deployed (P6-04); the
  // account id is a plain string either way.
  CLOUDFLARE_API_TOKEN?: string | SecretsStoreSecret;
  CLOUDFLARE_ACCOUNT_ID?: string;
  // Cloudflare Access: the Zero Trust team subdomain and the control-plane
  // application's AUD tag. When both are set the Worker verifies the
  // `Cf-Access-Jwt-Assertion` header on every `/v1` request except `/v1/health`
  // (ADR-0005, P6-03); when either is absent it runs ungated, for local
  // `alchemy dev`. Local `.dev.vars`; deployed from Secrets Store (P6-04).
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

export type Variables = {
  db: Database;
  project: Project;
  // Null when the Cloudflare API credentials above aren't configured.
  observability: ObservabilityClient | null;
  // The verified Access JWT claims, set by the Access middleware (P6-03). Absent
  // when the Worker runs ungated (no `CF_ACCESS_*` bindings) or on `/v1/health`.
  accessJwt?: JWTPayload;
};

export type Env = { Bindings: Bindings; Variables: Variables };
