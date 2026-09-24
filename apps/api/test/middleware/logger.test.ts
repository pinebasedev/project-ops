import { type Context, Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/env";
import { loggerMiddleware, requestIdMiddleware } from "../../src/middleware";

afterEach(() => {
  vi.restoreAllMocks();
});

type Line = Record<string, unknown>;

function linesMatching(spy: { mock: { calls: unknown[][] } }, message: string): Line[] {
  return spy.mock.calls.map((call) => call[0] as Line).filter((line) => line?.message === message);
}

function appWith(handler: (c: Context<Env>) => Response) {
  const app = new Hono<Env>();
  app.use("*", requestIdMiddleware);
  app.use("*", loggerMiddleware);
  app.get("/ok", (c) => handler(c));
  app.get("/boom", () => {
    throw new Error("kaboom");
  });
  app.onError((_e, c) => c.json({ error: "Internal Server Error" }, 500));
  return app;
}

describe("loggerMiddleware", () => {
  it("logs one request line with method, path, status, and duration", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = appWith((c) => c.json({ ok: true }));

    await app.request("/ok");

    const requestLines = linesMatching(log, "request");
    expect(requestLines).toHaveLength(1);
    expect(requestLines[0]!).toMatchObject({
      level: "info",
      method: "GET",
      path: "/ok",
      status: 200,
    });
    expect(typeof requestLines[0]!.durationMs).toBe("number");
  });

  it("binds the logger to the request id and exposes it on the context", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = appWith((c) => {
      c.get("logger").info("handler ran");
      return c.json({ ok: true });
    });

    const res = await app.request("/ok");
    const requestId = res.headers.get("x-request-id");

    expect(linesMatching(log, "handler ran")[0]!).toMatchObject({ requestId });
  });

  it("logs at error level when the response is a 5xx", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = appWith((c) => c.json({ ok: true }));

    await app.request("/boom");

    expect(linesMatching(errSpy, "request failed")[0]!).toMatchObject({
      level: "error",
      status: 500,
      path: "/boom",
    });
  });
});
