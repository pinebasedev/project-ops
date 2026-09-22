import { createApp } from "control-plane/app";
import { createTestDb, seedProject } from "control-plane/testing";
import { describe, expect, it } from "vitest";
import { createApiClient } from "./client";
import { createControlPlane, type ControlPlane } from "./controlPlane";

// The second adapter at the client seam: the real control-plane Hono app, run
// in-process against an in-memory SQLite database. No network, no fakes of our
// own — if a response shape drifts, these fail.
async function withRealControlPlane(): Promise<{
  controlPlane: ControlPlane;
  db: Awaited<ReturnType<typeof createTestDb>>;
}> {
  const db = await createTestDb();
  const app = createApp({ db, accessJwt: null });
  const client = createApiClient("http://control-plane.test", async (input, init) =>
    app.request(input as RequestInfo, init as RequestInit),
  );
  return { controlPlane: createControlPlane(client), db };
}

// A client whose transport always answers with the given status, for the
// failure protocol. `createControlPlane` takes its client, so no module mocking.
function withStatus(status: number, body: unknown = { error: "nope" }) {
  const client = createApiClient("http://control-plane.test", async () =>
    Response.json(body, { status }),
  );
  return createControlPlane(client);
}

describe("against the real control plane", () => {
  it("lists projects without leaking the token hash", async () => {
    const { controlPlane, db } = await withRealControlPlane();
    await seedProject(db, { name: "demo-project" });

    const projects = await controlPlane.listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("demo-project");
    expect(projects[0]).not.toHaveProperty("tokenHash");
  });

  it("resolves one project by id", async () => {
    const { controlPlane, db } = await withRealControlPlane();
    const { id } = await seedProject(db, { name: "demo-project" });

    await expect(controlPlane.getProject(id)).resolves.toMatchObject({ id, name: "demo-project" });
  });

  it("404s for a project that does not exist", async () => {
    const { controlPlane } = await withRealControlPlane();

    await expect(controlPlane.getProject("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("404s for an environment that does not exist", async () => {
    const { controlPlane } = await withRealControlPlane();

    await expect(controlPlane.getEnvironment("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("returns an Environment recorded by a deployment callback, with its latest Deployment", async () => {
    const { controlPlane, db } = await withRealControlPlane();
    const { id: projectId, token } = await seedProject(db);
    const app = createApp({ db, accessJwt: null });

    // Drive the real callback route the way demo-project's CI does (P1-08).
    const created = await app.request("/v1/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        stageName: "pr-42",
        kind: "ephemeral",
        commitSha: "abc123",
        prNumber: 42,
      }),
    });
    const { environmentId } = (await created.json()) as { environmentId: string };

    const environments = await controlPlane.listEnvironments(projectId, "ephemeral");
    expect(environments).toHaveLength(1);
    expect(environments[0].latestDeployment).toMatchObject({
      status: "in_progress",
      commitSha: "abc123",
      prNumber: 42,
    });

    const detail = await controlPlane.getEnvironment(environmentId);
    expect(detail).toMatchObject({ stageName: "pr-42", kind: "ephemeral" });
  });

  it("returns null for a kind the project has no Environment of", async () => {
    const { controlPlane, db } = await withRealControlPlane();
    const { id } = await seedProject(db);

    await expect(controlPlane.getEnvironmentOfKind(id, "staging")).resolves.toBeNull();
  });
});

describe("failure protocol", () => {
  it("reports an unreachable control plane as 502", async () => {
    await expect(withStatus(500).listProjects()).rejects.toMatchObject({
      status: 502,
      body: { message: "Could not reach the control-plane API" },
    });
  });

  // The reason this module exists: behind Cloudflare Access (ADR-0005) an
  // expired session is answered by the edge, not the Worker. Reporting that as
  // "could not reach the API" sends someone debugging the wrong system.
  it.each([401, 403])("reports an Access rejection (%i) as a session problem", async (status) => {
    await expect(withStatus(status).listProjects()).rejects.toMatchObject({
      status: 401,
      body: { message: expect.stringContaining("Access session has expired") },
    });
  });
});
