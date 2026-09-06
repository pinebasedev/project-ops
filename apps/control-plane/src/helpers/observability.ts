import type { Bindings } from "../env";

// One flattened error line, distilled from a Telemetry API event. The control
// plane stores nothing — this is what the errors route returns and immediately
// forgets (ADR-0004).
export type ObservedError = {
  /** ISO-8601, from the event's epoch-millisecond timestamp. */
  timestamp: string;
  message: string;
  /** Always "error" today — the query filters on it — but passed through as-is. */
  level: string;
  /** Ties the line back to a single Worker invocation; null when absent. */
  requestId: string | null;
};

export type RecentErrorsQuery = {
  workerName: string;
  from: Date;
  to: Date;
  limit?: number;
};

export interface ObservabilityClient {
  recentErrors(query: RecentErrorsQuery): Promise<ObservedError[]>;
}

// Thrown for any failure talking to the Telemetry API (network error, non-2xx).
// The errors route turns this into a 502 rather than a 500, since it's an
// upstream-dependency failure, not a bug here.
export class ObservabilityError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ObservabilityError";
  }
}

/**
 * The managed Worker whose telemetry belongs to an Environment. Alchemy names
 * each managed project's Worker `<project>-<stage>` (e.g. `demo-project-staging`,
 * `demo-project-pr-42`); demo-project's staging/prod Alchemy stages (written in
 * Phase 6) are set up to match. Kept as one helper so that cross-repo naming
 * convention has a single home — see ADR-0004.
 */
export function workerServiceName(
  project: { name: string },
  environment: { stageName: string },
): string {
  return `${project.name}-${environment.stageName}`;
}

const TELEMETRY_DATASET = "cloudflare-workers";
const DEFAULT_LIMIT = 100;

type TelemetryEnvelope = {
  result?: {
    events?: {
      events?: Array<{
        timestamp?: number;
        $metadata?: {
          message?: string;
          error?: string;
          level?: string;
          requestId?: string;
        };
      }>;
    };
  };
};

/**
 * A live {@link ObservabilityClient} backed by Cloudflare's Workers Observability
 * Telemetry API (`POST /accounts/{id}/workers/observability/telemetry/query`).
 * `fetch` is injectable for tests.
 */
export function createTelemetryClient(config: {
  apiToken: string;
  accountId: string;
  fetch?: typeof fetch;
}): ObservabilityClient {
  const doFetch = config.fetch ?? fetch;
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/workers/observability/telemetry/query`;

  return {
    async recentErrors({ workerName, from, to, limit = DEFAULT_LIMIT }) {
      let response: Response;
      try {
        response = await doFetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queryId: "pinebase-recent-errors",
            view: "events",
            limit,
            timeframe: { from: from.getTime(), to: to.getTime() },
            parameters: {
              datasets: [TELEMETRY_DATASET],
              filters: [
                {
                  key: "$metadata.service",
                  type: "string",
                  operation: "eq",
                  value: workerName,
                },
                { key: "$metadata.level", type: "string", operation: "eq", value: "error" },
              ],
            },
          }),
        });
      } catch (cause) {
        throw new ObservabilityError("Failed to reach the Telemetry API", { cause });
      }

      if (!response.ok) {
        throw new ObservabilityError(`Telemetry API responded ${response.status}`);
      }

      const body = (await response.json()) as TelemetryEnvelope;
      const events = body.result?.events?.events ?? [];
      return events.map((event) => {
        const meta = event.$metadata ?? {};
        return {
          timestamp: new Date(event.timestamp ?? 0).toISOString(),
          message: meta.message ?? meta.error ?? "(no message)",
          level: meta.level ?? "error",
          requestId: meta.requestId ?? null,
        };
      });
    },
  };
}

/** Builds a client from the Worker bindings, or null when either credential is absent. */
export function observabilityFromEnv(
  env: Partial<Bindings> | undefined,
): ObservabilityClient | null {
  if (!env?.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return null;
  return createTelemetryClient({
    apiToken: env.CLOUDFLARE_API_TOKEN,
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
  });
}
