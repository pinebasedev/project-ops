import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { deployments, environments, projects } from "../../src/db/schema";
import type { ObservabilityClient } from "../../src/helpers/observability";
import { ObservabilityError } from "../../src/helpers/observability";
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

describe("GET /v1/environments/:id/errors", () => {
  it("returns errors since the latest deployment, scoped to the environment's worker", async () => {
    const db = await createTestDb();
    await seed(db);
    const recentErrors = vi
      .fn()
      .mockResolvedValue([
        { timestamp: "2026-01-02T01:00:00.000Z", message: "boom", level: "error", requestId: "r1" },
      ]);
    const observability: ObservabilityClient = { recentErrors };
    const app = createApp({ db, observability });

    const res = await app.request("/v1/environments/env-1/errors");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      workerName: "svelteflare-pr-1",
      since: "2026-01-02T00:00:00.000Z",
      errors: [
        { timestamp: "2026-01-02T01:00:00.000Z", message: "boom", level: "error", requestId: "r1" },
      ],
    });

    expect(recentErrors).toHaveBeenCalledWith(
      expect.objectContaining({
        workerName: "svelteflare-pr-1",
        from: new Date("2026-01-02T00:00:00.000Z"),
      }),
    );
  });

  it("passes a bounded limit through from the query string", async () => {
    const db = await createTestDb();
    await seed(db);
    const recentErrors = vi.fn().mockResolvedValue([]);
    const app = createApp({ db, observability: { recentErrors } });

    await app.request("/v1/environments/env-1/errors?limit=10");
    expect(recentErrors).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  it("rejects a non-positive or oversized limit", async () => {
    const db = await createTestDb();
    await seed(db);
    const app = createApp({ db, observability: { recentErrors: vi.fn() } });

    expect((await app.request("/v1/environments/env-1/errors?limit=0")).status).toBe(400);
    expect((await app.request("/v1/environments/env-1/errors?limit=5000")).status).toBe(400);
  });

  it("returns an empty result with a null window when the environment has never deployed", async () => {
    const db = await createTestDb();
    await seed(db);
    const recentErrors = vi.fn();
    const app = createApp({ db, observability: { recentErrors } });

    const res = await app.request("/v1/environments/env-2/errors");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      workerName: "svelteflare-pr-2",
      since: null,
      errors: [],
    });
    expect(recentErrors).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown environment", async () => {
    const db = await createTestDb();
    const app = createApp({ db, observability: { recentErrors: vi.fn() } });

    const res = await app.request("/v1/environments/nope/errors");
    expect(res.status).toBe(404);
  });

  it("returns 503 when observability is not configured", async () => {
    const db = await createTestDb();
    await seed(db);
    const app = createApp({ db, observability: null });

    const res = await app.request("/v1/environments/env-1/errors");
    expect(res.status).toBe(503);
  });

  it("returns 502 when the Telemetry API is unreachable", async () => {
    const db = await createTestDb();
    await seed(db);
    const recentErrors = vi.fn().mockRejectedValue(new ObservabilityError("down"));
    const app = createApp({ db, observability: { recentErrors } });

    const res = await app.request("/v1/environments/env-1/errors");
    expect(res.status).toBe(502);
  });

  it("returns 503 when the Telemetry API rejects the credentials", async () => {
    const db = await createTestDb();
    await seed(db);
    const recentErrors = vi
      .fn()
      .mockRejectedValue(new ObservabilityError("bad token", { kind: "auth" }));
    const app = createApp({ db, observability: { recentErrors } });

    const res = await app.request("/v1/environments/env-1/errors");
    expect(res.status).toBe(503);
  });
});
