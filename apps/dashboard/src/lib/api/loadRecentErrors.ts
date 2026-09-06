import { api } from "./client";

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
  let res: Awaited<ReturnType<(typeof api.v1.environments)[":id"]["errors"]["$get"]>>;
  try {
    res = await api.v1.environments[":id"].errors.$get({
      param: { id: environmentId },
      query: {},
    });
  } catch {
    return { state: "unavailable" };
  }

  if (res.status === 503) return { state: "not-configured" };
  if (!res.ok) return { state: "unavailable" };

  const body = await res.json();
  return {
    state: "ok",
    workerName: body.workerName,
    since: body.since,
    errors: "errors" in body ? body.errors : [],
  };
}
