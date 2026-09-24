import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { deployments, environments, projects } from "../../src/db/schema";
import { createTestDb } from "../helpers/db";

async function seed(db: Awaited<ReturnType<typeof createTestDb>>) {
  await db.insert(projects).values({ id: "proj-1", name: "svelteflare", tokenHash: "hash" });
  await db.insert(environments).values([
    { id: "env-1", projectId: "proj-1", kind: "ephemeral", stageName: "pr-1" },
    { id: "env-2", projectId: "proj-1", kind: "ephemeral", stageName: "pr-2" },
    { id: "env-3", projectId: "proj-1", kind: "staging", stageName: "staging" },
  ]);
  await db.insert(deployments).values([
    {
      id: "dep-1-old",
      environmentId: "env-1",
      status: "done",
      commitSha: "aaa111",
      prNumber: 1,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      id: "dep-1-new",
      environmentId: "env-1",
      status: "in_progress",
      commitSha: "bbb222",
      prNumber: 1,
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    },
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

  it("embeds each environment's latest deployment", async () => {
    const db = await createTestDb();
    await seed(db);
    const app = createApp({ db });

    const res = await app.request("/v1/projects/proj-1/environments");
    const body = (await res.json()) as {
      id: string;
      latestDeployment: { id: string; commitSha: string; status: string } | null;
    }[];

    const withDeployment = body.find((e) => e.id === "env-1");
    expect(withDeployment?.latestDeployment).toMatchObject({
      id: "dep-1-new",
      commitSha: "bbb222",
      status: "in_progress",
    });

    const withoutDeployment = body.find((e) => e.id === "env-2");
    expect(withoutDeployment?.latestDeployment).toBeNull();
  });

  it("breaks a same-second createdAt tie deterministically", async () => {
    const db = await createTestDb();
    await seed(db);
    const sameSecond = new Date("2026-02-01T00:00:00Z");
    await db.insert(deployments).values([
      {
        id: "dep-tie-a",
        environmentId: "env-3",
        status: "done",
        commitSha: "t1",
        createdAt: sameSecond,
        updatedAt: sameSecond,
      },
      {
        id: "dep-tie-b",
        environmentId: "env-3",
        status: "done",
        commitSha: "t2",
        createdAt: sameSecond,
        updatedAt: sameSecond,
      },
    ]);
    const app = createApp({ db });

    const res = await app.request("/v1/projects/proj-1/environments");
    const body = (await res.json()) as { id: string; latestDeployment: { id: string } | null }[];
    expect(body.find((e) => e.id === "env-3")?.latestDeployment?.id).toBe("dep-tie-b");
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
    expect(await res.json()).toMatchObject({
      id: "env-1",
      stageName: "pr-1",
      latestDeployment: { id: "dep-1-new", commitSha: "bbb222", status: "in_progress" },
    });
  });

  it("returns a null latest deployment when the environment has none", async () => {
    const db = await createTestDb();
    await seed(db);
    const app = createApp({ db });

    const res = await app.request("/v1/environments/env-2");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "env-2", latestDeployment: null });
  });

  it("returns 404 for an unknown environment", async () => {
    const db = await createTestDb();
    const app = createApp({ db });

    const res = await app.request("/v1/environments/nope");
    expect(res.status).toBe(404);
  });
});
