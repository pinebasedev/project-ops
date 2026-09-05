import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

describe("createApp", () => {
  it("mounts routes under /v1", async () => {
    const app = createApp();
    const res = await app.request("/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns a sanitized 404 for unknown routes", async () => {
    const app = createApp();
    const res = await app.request("/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  it("applies security headers to every response", async () => {
    const app = createApp();
    const res = await app.request("/v1/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  it("tags every response with a request id", async () => {
    const app = createApp();
    const res = await app.request("/v1/health");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("does not mount routes outside of /v1", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(404);
  });
});
