import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { deployments, environments } from "../db/schema";
import type { Env } from "../env";
import { notFoundJson } from "../helpers/errors";
import { flattenLatestDeployment } from "../helpers/environments";

export const environmentRoutes = new Hono<Env>().get("/:id", async (c) => {
  const environment = await c.get("db").query.environments.findFirst({
    where: eq(environments.id, c.req.param("id")),
    with: {
      deployments: {
        orderBy: [desc(deployments.createdAt)],
        limit: 1,
      },
    },
  });
  if (!environment) return notFoundJson(c);
  return c.json(flattenLatestDeployment(environment));
});
