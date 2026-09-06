import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { environments } from "../db/schema";
import type { Env } from "../env";
import { flattenLatestDeployment, withLatestDeployment } from "../helpers/environments";
import { notFoundJson } from "../helpers/errors";

export const environmentRoutes = new Hono<Env>().get("/:id", async (c) => {
  const environment = await c.get("db").query.environments.findFirst({
    where: eq(environments.id, c.req.param("id")),
    with: withLatestDeployment,
  });
  if (!environment) return notFoundJson(c);
  return c.json(flattenLatestDeployment(environment));
});
