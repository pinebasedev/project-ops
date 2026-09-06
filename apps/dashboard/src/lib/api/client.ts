import { env } from "$env/dynamic/public";
import type { AppType } from "control-plane/app";
import { hc } from "hono/client";

// The control-plane API base URL. Baked in at build time from
// PUBLIC_CONTROL_PLANE_URL; defaults to the local `vite dev` port of the
// control-plane worker (see its wrangler.jsonc / dev script).
const baseUrl = env.PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:9003";

/**
 * End-to-end typed RPC client for the control-plane API, derived from its Hono
 * `AppType` export — no codegen. See ARCHITECTURE.md ("Typed client").
 */
export const api = hc<AppType>(baseUrl);
