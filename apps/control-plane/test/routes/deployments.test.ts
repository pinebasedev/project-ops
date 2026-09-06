import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Database } from "../../src/db/client";
import { environments } from "../../src/db/schema";
import { createApp } from "../../src/app";
import { createTestDb, seedProject } from "../helpers/db";

describe("POST /v1/deployments", () => {
  it("rejects requests without a valid project token", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/v1/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageName: "pr-42", kind: "ephemeral", commitSha: "abc123" }),
    });
    expect(res.status).toBe(401);
  });

  it("creates an environment and an in_progress deployment on first deploy", async () => {
    const db = await createTestDb();
    const { id: projectId, token } = await seedProject(db);
    const app = createApp({ db });

    const res = await app.request("/v1/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        stageName: "pr-42",
        kind: "ephemeral",
        commitSha: "abc123",
        prNumber: 42,
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { deploymentId: string; environmentId: string };
    expect(typeof body.deploymentId).toBe("string");
    expect(typeof body.environmentId).toBe("string");

    const [env] = await db
      .select()
      .from(environments)
      .where(eq(environments.id, body.environmentId));
    expect(env).toMatchObject({ projectId, kind: "ephemeral", stageName: "pr-42" });
  });

  it("reuses the same environment for a redeploy of the same stage", async () => {
    const db = await createTestDb();
    const { token } = await seedProject(db);
    const app = createApp({ db });

    const deploy = (commitSha: string) =>
      app.request("/v1/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stageName: "pr-42", kind: "ephemeral", commitSha }),
      });

    const first = (await (await deploy("commit-1")).json()) as { environmentId: string };
    const second = (await (await deploy("commit-2")).json()) as { environmentId: string };

    expect(second.environmentId).toBe(first.environmentId);
  });

  it("rejects an invalid body", async () => {
    const db = await createTestDb();
    const { token } = await seedProject(db);
    const app = createApp({ db });

    const res = await app.request("/v1/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stageName: "pr-42" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/deployments/:id/complete", () => {
  it("marks a deployment done with a preview url", async () => {
    const db = await createTestDb();
    const { token } = await seedProject(db);
    const deploymentId = await createInProgressDeployment(db, token);
    const app = createApp({ db });

    const res = await app.request(`/v1/deployments/${deploymentId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "done", previewUrl: "https://pr-42.example.com" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; previewUrl: string };
    expect(body).toMatchObject({ status: "done", previewUrl: "https://pr-42.example.com" });
  });

  it("marks a deployment failed", async () => {
    const db = await createTestDb();
    const { token } = await seedProject(db);
    const deploymentId = await createInProgressDeployment(db, token);
    const app = createApp({ db });

    const res = await app.request(`/v1/deployments/${deploymentId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "failed" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "failed" });
  });

  it("returns 404 when a different project tries to complete this deployment", async () => {
    const db = await createTestDb();
    const { token } = await seedProject(db);
    const deploymentId = await createInProgressDeployment(db, token);

    const other = await seedProject(db);
    const app = createApp({ db });

    const res = await app.request(`/v1/deployments/${deploymentId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${other.token}` },
      body: JSON.stringify({ status: "done" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /v1/deployments/:id", () => {
  it("returns a deployment without requiring auth", async () => {
    const db = await createTestDb();
    const { token } = await seedProject(db);
    const deploymentId = await createInProgressDeployment(db, token);
    const app = createApp({ db });

    const res = await app.request(`/v1/deployments/${deploymentId}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ commitSha: "abc123", status: "in_progress" });
  });

  it("returns 404 for an unknown deployment", async () => {
    const db = await createTestDb();
    const app = createApp({ db });
    const res = await app.request("/v1/deployments/nope");
    expect(res.status).toBe(404);
  });
});

async function createInProgressDeployment(db: Database, token: string) {
  const res = await createApp({ db }).request("/v1/deployments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ stageName: "pr-42", kind: "ephemeral", commitSha: "abc123" }),
  });
  return ((await res.json()) as { deploymentId: string }).deploymentId;
}
