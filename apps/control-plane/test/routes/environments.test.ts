import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { environments, projects } from "../../src/db/schema";
import { createTestDb } from "../helpers/db";

async function seed(db: Awaited<ReturnType<typeof createTestDb>>) {
  await db.insert(projects).values({ id: "proj-1", name: "svelteflare", tokenHash: "hash" });
  await db.insert(environments).values([
    { id: "env-1", projectId: "proj-1", kind: "ephemeral", stageName: "pr-1" },
    { id: "env-2", projectId: "proj-1", kind: "ephemeral", stageName: "pr-2" },
    { id: "env-3", projectId: "proj-1", kind: "staging", stageName: "staging" },
  ]);
}

describe("GET /v1/projects/:projectId/environments", () => {
  it("lists all environments for a project", async () => {
    const db = await createTestDb();
    await seed(db);
    const app = createApp({ db });

    const res = await app.request("/v1/projects/proj-1/environments");
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(3);
  });

  it("filters by kind", async () => {
    const db = await createTestDb();
    await seed(db);
    const app = createApp({ db });

    const res = await app.request("/v1/projects/proj-1/environments?kind=ephemeral");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stageName: string }[];
    expect(body.map((e) => e.stageName).sort()).toEqual(["pr-1", "pr-2"]);
  });

  it("returns an empty list for a project with no environments", async () => {
    const db = await createTestDb();
    const app = createApp({ db });

    const res = await app.request("/v1/projects/unknown-project/environments");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("GET /v1/environments/:id", () => {
  it("returns a single environment", async () => {
    const db = await createTestDb();
    await seed(db);
    const app = createApp({ db });

    const res = await app.request("/v1/environments/env-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "env-1", stageName: "pr-1" });
  });

  it("returns 404 for an unknown environment", async () => {
    const db = await createTestDb();
    const app = createApp({ db });

    const res = await app.request("/v1/environments/nope");
    expect(res.status).toBe(404);
  });
});
