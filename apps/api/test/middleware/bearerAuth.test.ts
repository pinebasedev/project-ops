import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Env } from "../../src/env";
import { bearerAuthMiddleware } from "../../src/middleware/bearerAuth";
import { createTestDb, seedProject } from "../helpers/db";

async function setup() {
  const db = await createTestDb();
  const { id, token } = await seedProject(db, { id: "proj-1", name: "svelteflare" });

  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.use("*", bearerAuthMiddleware);
  app.get("/whoami", (c) => c.json({ projectId: c.get("project").id }));

  return { app, token, id };
}

describe("bearerAuthMiddleware", () => {
  it("rejects a missing Authorization header", async () => {
    const { app } = await setup();
    const res = await app.request("/whoami");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed Authorization header", async () => {
    const { app } = await setup();
    const res = await app.request("/whoami", {
      headers: { Authorization: "not-bearer" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown token", async () => {
    const { app } = await setup();
    const res = await app.request("/whoami", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  it("attaches the project for a valid token", async () => {
    const { app, token, id } = await setup();
    const res = await app.request("/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ projectId: id });
  });
});
