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
 *
 * This is transport only. Callers go through the control-plane module in
 * `controlPlane.ts` rather than reaching for this directly, so the HTTP error
 * protocol lives in one place.
 */
export type ApiClient = ReturnType<typeof hc<AppType>>;

// `credentials: "include"`: this is a cross-origin fetch (the dashboard and
// the control plane are separate Workers/hostnames), and without it the
// browser won't attach the Access session cookie — the control-plane's own
// `cors()` middleware (`credentials: true`) is the other half of this, see
// ADR-0005's update.
export const api: ApiClient = hc<AppType>(baseUrl, { init: { credentials: "include" } });

/**
 * A client pointed at an arbitrary base URL and `fetch`. Tests pass the
 * control-plane's own `createApp().request`, which runs the real API in-process
 * with no network — the second adapter at this seam.
 */
export function createApiClient(url: string, fetchImpl?: typeof fetch): ApiClient {
  return hc<AppType>(url, fetchImpl ? { fetch: fetchImpl } : undefined);
}
