import { api } from "./client";

// The dashboard's view model for one error line. Deliberately hand-written rather
// than pulled off the wire type: the control plane doesn't export it as a named
// type over RPC, and a 4-field view model reads better here than
// `Extract<Awaited<ReturnType<…>>>` acrobatics.
export type ObservedError = {
  timestamp: string;
  message: string;
  level: string;
  requestId: string | null;
};

/**
 * The recent-errors panel's data, as a discriminated result rather than a thrown
 * error: the Telemetry API is a soft dependency (ADR-0004), so a control plane
 * without credentials or an unreachable upstream degrades the panel, never the
 * whole environment page.
 */
export type RecentErrors =
  | { state: "ok"; workerName: string; since: string | null; errors: ObservedError[] }
  | { state: "not-configured" }
  | { state: "unavailable" };

export async function loadRecentErrors(environmentId: string): Promise<RecentErrors> {
  try {
    const res = await api.v1.environments[":id"].errors.$get({
      param: { id: environmentId },
      query: {},
    });

    // 503 covers both "no credentials configured" and "credentials rejected" —
    // either way the control plane can't answer, and retrying won't help.
    if (res.status === 503) return { state: "not-configured" };
    if (!res.ok) return { state: "unavailable" };

    const body = await res.json();
    return {
      state: "ok",
      workerName: body.workerName,
      since: body.since,
      errors: "errors" in body ? body.errors : [],
    };
  } catch {
    return { state: "unavailable" };
  }
}
