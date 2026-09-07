import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { environmentKinds, environments, projects } from "../db/schema";
import type { Env } from "../env";
import { isUniqueConstraintError } from "../helpers/dbErrors";
import { flattenLatestDeployment, withLatestDeployment } from "../helpers/environments";
import { mintToken } from "../helpers/tokens";

// `owner/repo`, GitHub's own shape — just enough to build a compare-view URL
// (ADR-0007). Not a full URL: the control plane only ever links out, never calls.
const githubRepoSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/, "Expected an owner/repo slug");

const registerSchema = z.object({
  name: z.string().min(1),
  githubRepo: githubRepoSchema.optional(),
});
const listEnvironmentsQuerySchema = z.object({ kind: z.enum(environmentKinds).optional() });

export const projectRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const rows = await c.get("db").query.projects.findMany({
      columns: { tokenHash: false },
      orderBy: [desc(projects.createdAt)],
    });
    return c.json(rows);
  })
  .post("/", zValidator("json", registerSchema), async (c) => {
    const { name, githubRepo } = c.req.valid("json");
    const { token, tokenHash } = await mintToken();
    const id = crypto.randomUUID();

    try {
      await c
        .get("db")
        .insert(projects)
        .values({ id, name, tokenHash, githubRepo: githubRepo ?? null });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        c.get("logger").warn("project registration rejected", { reason: "duplicate name", name });
        return c.json({ error: "A project with that name already exists" }, 409);
      }
      throw error;
    }

    return c.json({ id, name, githubRepo: githubRepo ?? null, token }, 201);
  })
  .get("/:projectId/environments", zValidator("query", listEnvironmentsQuerySchema), async (c) => {
    const { projectId } = c.req.param();
    const { kind } = c.req.valid("query");

    const rows = await c.get("db").query.environments.findMany({
      where: kind
        ? and(eq(environments.projectId, projectId), eq(environments.kind, kind))
        : eq(environments.projectId, projectId),
      with: withLatestDeployment,
    });

    return c.json(rows.map(flattenLatestDeployment));
  });
