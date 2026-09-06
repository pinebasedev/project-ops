import { env } from "$env/dynamic/public";
import type { AppType } from "control-plane/app";
import { hc } from "hono/client";

// The control-plane API base URL. `alchemy dev` / `alchemy deploy` wire the real
// URL in as PUBLIC_CONTROL_PLANE_URL (see `alchemy.run.ts`); the fallback is the
// control-plane's pinned local port (`dev: { port: 9003 }` there), for a
// standalone `vite dev` of just this app.
const baseUrl = env.PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:9003";

/**
 * End-to-end typed RPC client for the control-plane API, derived from its Hono
 * `AppType` export — no codegen. See ARCHITECTURE.md ("Typed client").
 */
export const api = hc<AppType>(baseUrl);
