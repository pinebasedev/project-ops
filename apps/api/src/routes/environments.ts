import { Hono } from "hono";
import type { Env } from "../env";
import {
  findEnvironmentWithLatestDeployment,
  flattenLatestDeployment,
} from "../helpers/environments";
import { notFoundJson } from "../helpers/errors";
import { requireIdentityMiddleware } from "../middleware/requireIdentity";

// Dashboard-only, like the reads in routes/projects.ts — see that file's
// comment and ADR-0011 for why identity is required here.
export const environmentRoutes = new Hono<Env>().get(
  "/:id",
  requireIdentityMiddleware,
  async (c) => {
    const environment = await findEnvironmentWithLatestDeployment(c.get("db"), c.req.param("id"));
    if (!environment) return notFoundJson(c);
    return c.json(flattenLatestDeployment(environment));
  },
);
