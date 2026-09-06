import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { createTestDb, seedProject } from "../helpers/db";

describe("GET /v1/projects", () => {
  it("lists registered projects without exposing token hashes", async () => {
    const db = await createTestDb();
    await seedProject(db, { name: "svelteflare" });
    await seedProject(db, { name: "another" });
    const app = createApp({ db });

    const res = await app.request("/v1/projects");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body.map((p) => p.name).sort()).toEqual(["another", "svelteflare"]);
    for (const project of body) {
      expect(project).not.toHaveProperty("tokenHash");
    }
  });

  it("returns an empty list when no projects are registered", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/v1/projects");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

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
