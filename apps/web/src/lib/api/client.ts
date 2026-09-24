import type { AppType } from "api/app";
import { hc } from "hono/client";

// The control plane is mounted same-origin at `/v1/*` (see `+server.ts` under
// `routes/v1/[...rest]`, and ADR-0009)
// — no base URL to configure, and no cross-origin credentials opt-in needed:
// the browser sends the Access session cookie to same-origin requests as a
// matter of course.
const baseUrl = "/";

/**
 * End-to-end typed RPC client for the control-plane API, derived from its Hono
 * `AppType` export — no codegen. See ARCHITECTURE.md ("Typed client").
 *
 * This is transport only. Callers go through the control-plane module in
 * `controlPlane.ts` rather than reaching for this directly, so the HTTP error
 * protocol lives in one place.
 */
export type ApiClient = ReturnType<typeof hc<AppType>>;

export const api: ApiClient = hc<AppType>(baseUrl);

/**
 * A client pointed at an arbitrary base URL and `fetch`. Tests pass the
 * control-plane's own `createApp().request`, which runs the real API in-process
 * with no network — the second adapter at this seam.
 */
export function createApiClient(url: string, fetchImpl?: typeof fetch): ApiClient {
  return hc<AppType>(url, fetchImpl ? { fetch: fetchImpl } : undefined);
}
