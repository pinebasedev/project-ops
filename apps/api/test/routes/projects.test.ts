import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { createTestDb, seedProject } from "../helpers/db";

describe("GET /v1/projects", () => {
  it("lists registered projects without exposing token hashes", async () => {
    const db = await createTestDb();
    await seedProject(db, { name: "demo-project" });
    await seedProject(db, { name: "another" });
    const app = createApp({ db });

    const res = await app.request("/v1/projects");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body.map((p) => p.name).sort()).toEqual(["another", "demo-project"]);
    for (const project of body) {
      expect(project).not.toHaveProperty("tokenHash");
    }
  });

  it("exposes each project's github repo slug (null when unset)", async () => {
    const db = await createTestDb();
    await seedProject(db, { name: "with-repo", githubRepo: "example-org/demo-project" });
    await seedProject(db, { name: "without-repo" });
    const app = createApp({ db });

    const res = await app.request("/v1/projects");
    const body = (await res.json()) as { name: string; githubRepo: string | null }[];
    expect(body.find((p) => p.name === "with-repo")?.githubRepo).toBe("example-org/demo-project");
    expect(body.find((p) => p.name === "without-repo")?.githubRepo).toBeNull();
  });

  it("returns an empty list when no projects are registered", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/v1/projects");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
