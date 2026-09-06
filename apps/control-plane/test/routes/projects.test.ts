import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { createTestDb } from "../helpers/db";

describe("POST /v1/projects", () => {
  it("registers a project and mints a one-time token", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "svelteflare" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string; token: string };
    expect(body).toMatchObject({ name: "svelteflare" });
    expect(typeof body.id).toBe("string");
    expect(typeof body.token).toBe("string");
  });

  it("rejects a missing name", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate project name", async () => {
    const app = createApp({ db: await createTestDb() });
    const create = () =>
      app.request("/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "svelteflare" }),
      });

    expect((await create()).status).toBe(201);
    expect((await create()).status).toBe(409);
  });
});
