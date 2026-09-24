import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { notFound, onError } from "../../src/helpers/errors";

describe("onError", () => {
  it("returns a sanitized 500 without leaking the error message", async () => {
    const app = new Hono();
    app.get("/boom", () => {
      throw new Error("leaked secret detail");
    });
    app.onError(onError);

    const res = await app.request("/boom");

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Internal Server Error" });
    expect(JSON.stringify(body)).not.toContain("leaked secret detail");
  });
});

describe("notFound", () => {
  it("returns a sanitized 404 body", async () => {
    const app = new Hono();
    app.notFound(notFound);

    const res = await app.request("/nope");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });
});
