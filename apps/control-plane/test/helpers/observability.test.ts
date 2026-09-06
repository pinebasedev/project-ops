import { describe, expect, it, vi } from "vitest";
import {
  createTelemetryClient,
  ObservabilityError,
  observabilityFromEnv,
  workerServiceName,
} from "../../src/helpers/observability";

describe("workerServiceName", () => {
  it("joins the project name and the Alchemy stage", () => {
    expect(workerServiceName({ name: "demo-project" }, { stageName: "staging" })).toBe(
      "demo-project-staging",
    );
    expect(workerServiceName({ name: "demo-project" }, { stageName: "pr-42" })).toBe(
      "demo-project-pr-42",
    );
  });
});

describe("observabilityFromEnv", () => {
  it("returns null unless both the token and the account id are set", () => {
    expect(observabilityFromEnv(undefined)).toBeNull();
    expect(observabilityFromEnv({ CLOUDFLARE_API_TOKEN: "t" })).toBeNull();
    expect(observabilityFromEnv({ CLOUDFLARE_ACCOUNT_ID: "a" })).toBeNull();
  });

  it("builds a client when both are present", () => {
    const client = observabilityFromEnv({
      CLOUDFLARE_API_TOKEN: "t",
      CLOUDFLARE_ACCOUNT_ID: "a",
    });
    expect(client).not.toBeNull();
  });
});

describe("createTelemetryClient.recentErrors", () => {
  const from = new Date("2026-09-06T00:00:00.000Z");
  const to = new Date("2026-09-06T01:00:00.000Z");

  it("queries the Telemetry API scoped to the worker, error level and time window", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { events: { events: [] } } }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createTelemetryClient({
      apiToken: "secret-token",
      accountId: "acct-123",
      fetch: fetchMock,
    });

    await client.recentErrors({ workerName: "demo-project-staging", from, to, limit: 25 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct-123/workers/observability/telemetry/query",
    );
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer secret-token");

    const body = JSON.parse(init.body);
    expect(body.view).toBe("events");
    expect(body.limit).toBe(25);
    expect(body.timeframe).toEqual({ from: from.getTime(), to: to.getTime() });
    expect(body.parameters.datasets).toEqual(["cloudflare-workers"]);
    expect(body.parameters.filters).toEqual([
      { key: "$metadata.service", type: "string", operation: "eq", value: "demo-project-staging" },
      { key: "$metadata.level", type: "string", operation: "eq", value: "error" },
    ]);
  });

  it("maps telemetry events to a flat error shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            events: {
              events: [
                {
                  timestamp: Date.parse("2026-09-06T00:30:00.000Z"),
                  $metadata: {
                    message: "boom",
                    level: "error",
                    requestId: "req-1",
                  },
                },
                {
                  timestamp: Date.parse("2026-09-06T00:45:00.000Z"),
                  $metadata: { error: "TypeError: undefined", level: "error" },
                },
              ],
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createTelemetryClient({ apiToken: "t", accountId: "a", fetch: fetchMock });

    const errors = await client.recentErrors({ workerName: "w", from, to });

    expect(errors).toEqual([
      {
        timestamp: "2026-09-06T00:30:00.000Z",
        message: "boom",
        level: "error",
        requestId: "req-1",
      },
      {
        timestamp: "2026-09-06T00:45:00.000Z",
        message: "TypeError: undefined",
        level: "error",
        requestId: null,
      },
    ]);
  });

  it("throws ObservabilityError on a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 403 }));
    const client = createTelemetryClient({ apiToken: "t", accountId: "a", fetch: fetchMock });

    await expect(client.recentErrors({ workerName: "w", from, to })).rejects.toBeInstanceOf(
      ObservabilityError,
    );
  });

  it("throws ObservabilityError when the fetch itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    const client = createTelemetryClient({ apiToken: "t", accountId: "a", fetch: fetchMock });

    await expect(client.recentErrors({ workerName: "w", from, to })).rejects.toBeInstanceOf(
      ObservabilityError,
    );
  });
});
