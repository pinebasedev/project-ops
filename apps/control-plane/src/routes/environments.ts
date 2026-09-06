import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { projects } from "../db/schema";
import type { Env } from "../env";
import {
  findEnvironmentWithLatestDeployment,
  flattenLatestDeployment,
} from "../helpers/environments";
import { notFoundJson } from "../helpers/errors";
import { ObservabilityError, workerServiceName } from "../helpers/observability";

const errorsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const environmentRoutes = new Hono<Env>()
  .get("/:id", async (c) => {
    const environment = await findEnvironmentWithLatestDeployment(c.get("db"), c.req.param("id"));
    if (!environment) return notFoundJson(c);
    return c.json(flattenLatestDeployment(environment));
  })
  // Recent errors for an Environment's Worker, from its latest Deployment until
  // now — "what broke since the last deploy?" (ADR-0004). Queried live off
  // Cloudflare's Telemetry API on each request; nothing is stored.
  .get("/:id/errors", zValidator("query", errorsQuerySchema), async (c) => {
    const db = c.get("db");
    const { limit } = c.req.valid("query");

    const row = await findEnvironmentWithLatestDeployment(db, c.req.param("id"));
    if (!row) return notFoundJson(c);
    const environment = flattenLatestDeployment(row);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, environment.projectId),
    });
    if (!project) return notFoundJson(c);

    const workerName = workerServiceName(project, environment);

    // No deployment yet — there's no window to query and nothing to show.
    if (!environment.latestDeployment) {
      return c.json({ workerName, since: null, errors: [] });
    }

    const observability = c.get("observability");
    if (!observability) {
      return c.json({ error: "Observability is not configured" }, 503);
    }

    // The window opens at the latest Deployment. For a long-idle Environment that
    // can predate the Telemetry API's retention horizon, in which case the query
    // just comes back empty — acceptable, and simpler than clamping to a horizon
    // whose length is plan-dependent and unconfirmed (see ARCHITECTURE "Open items").
    const since = environment.latestDeployment.createdAt;
    try {
      const errors = await observability.recentErrors({
        workerName,
        from: since,
        to: new Date(),
        limit,
      });
      return c.json({ workerName, since: since.toISOString(), errors });
    } catch (error) {
      if (error instanceof ObservabilityError) {
        return error.kind === "auth"
          ? c.json({ error: "Observability credentials were rejected" }, 503)
          : c.json({ error: "Could not reach Cloudflare's Telemetry API" }, 502);
      }
      throw error;
    }
  });
