import type { D1Database } from "@cloudflare/workers-types";
import type { Database } from "./db/client";
import type { Project } from "./db/schema";
import type { ObservabilityClient } from "./helpers/observability";

export type Bindings = {
  DB: D1Database;
  // Cloudflare API token + account, used only to query the Workers Observability
  // Telemetry API for an Environment's recent errors (ADR-0004). Optional: the
  // errors route degrades to a "not configured" response when either is absent.
  // Local dev reads these from `.dev.vars`; deployed environments will read them
  // from Cloudflare Secrets Store (Phase 6, P6-04).
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
};

export type Variables = {
  db: Database;
  project: Project;
  // Null when the Cloudflare API credentials above aren't configured.
  observability: ObservabilityClient | null;
};

export type Env = { Bindings: Bindings; Variables: Variables };
