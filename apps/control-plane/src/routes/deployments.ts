import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../db/client";
import { deployments, environmentKinds, environments } from "../db/schema";
import type { Env } from "../env";
import { isUniqueConstraintError } from "../helpers/dbErrors";
import { notFoundJson } from "../helpers/errors";
import { bearerAuthMiddleware } from "../middleware/bearerAuth";

// A Deployment is only visible to the project that owns its Environment — the
// callback routes reject anything else with a 404 rather than leaking existence.
async function findOwnedDeployment(db: Database, id: string, projectId: string) {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, id),
    with: { environment: true },
  });
  return deployment && deployment.environment.projectId === projectId ? deployment : null;
}

const createDeploymentSchema = z.object({
  stageName: z.string().min(1),
  kind: z.enum(environmentKinds),
  commitSha: z.string().min(1),
  prNumber: z.number().int().optional(),
});

const completeDeploymentSchema = z.object({
  status: z.enum(["done", "failed"]),
  previewUrl: z.string().url().optional(),
});

const integrationResultsSchema = z.object({
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  runUrl: z.string().url(),
});

export const deploymentRoutes = new Hono<Env>()
  .post("/", bearerAuthMiddleware, zValidator("json", createDeploymentSchema), async (c) => {
    const { stageName, kind, commitSha, prNumber } = c.req.valid("json");
    const db = c.get("db");
    const project = c.get("project");

    let environment = await db.query.environments.findFirst({
      where: and(eq(environments.projectId, project.id), eq(environments.stageName, stageName)),
    });

    if (!environment) {
      const environmentId = crypto.randomUUID();
      try {
        await db.insert(environments).values({
          id: environmentId,
          projectId: project.id,
          kind,
          stageName,
        });
        environment = await db.query.environments.findFirst({
          where: eq(environments.id, environmentId),
        });
      } catch (error) {
        // A concurrent first-deploy of the same stage won the race — reuse its environment.
        if (!isUniqueConstraintError(error)) throw error;
        environment = await db.query.environments.findFirst({
          where: and(eq(environments.projectId, project.id), eq(environments.stageName, stageName)),
        });
      }
    }
    if (!environment) throw new Error("Failed to create environment");

    const deploymentId = crypto.randomUUID();
    await db.insert(deployments).values({
      id: deploymentId,
      environmentId: environment.id,
      status: "in_progress",
      commitSha,
      prNumber: prNumber ?? null,
    });

    return c.json({ deploymentId, environmentId: environment.id }, 201);
  })
  .post(
    "/:id/complete",
    bearerAuthMiddleware,
    zValidator("json", completeDeploymentSchema),
    async (c) => {
      const { status, previewUrl } = c.req.valid("json");
      const db = c.get("db");
      const id = c.req.param("id");

      if (!(await findOwnedDeployment(db, id, c.get("project").id))) {
        return notFoundJson(c);
      }

      await db
        .update(deployments)
        .set({ status, previewUrl: previewUrl ?? null, updatedAt: new Date() })
        .where(eq(deployments.id, id));

      const updated = await db.query.deployments.findFirst({ where: eq(deployments.id, id) });
      return c.json(updated, 200);
    },
  )
  .post(
    "/:id/integration-results",
    bearerAuthMiddleware,
    zValidator("json", integrationResultsSchema),
    async (c) => {
      const { passed, failed, runUrl } = c.req.valid("json");
      const db = c.get("db");
      const id = c.req.param("id");

      if (!(await findOwnedDeployment(db, id, c.get("project").id))) {
        return notFoundJson(c);
      }

      await db
        .update(deployments)
        .set({
          integrationTestsPassed: passed,
          integrationTestsFailed: failed,
          integrationTestsRunUrl: runUrl,
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, id));

      const updated = await db.query.deployments.findFirst({ where: eq(deployments.id, id) });
      return c.json(updated, 200);
    },
  )
  .get("/:id", async (c) => {
    const deployment = await c.get("db").query.deployments.findFirst({
      where: eq(deployments.id, c.req.param("id")),
    });
    if (!deployment) return notFoundJson(c);
    return c.json(deployment);
  });
