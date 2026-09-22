import { Hono } from "hono";
import type { Env } from "../env";
import {
  findEnvironmentWithLatestDeployment,
  flattenLatestDeployment,
} from "../helpers/environments";
import { notFoundJson } from "../helpers/errors";

export const environmentRoutes = new Hono<Env>().get("/:id", async (c) => {
  const environment = await findEnvironmentWithLatestDeployment(c.get("db"), c.req.param("id"));
  if (!environment) return notFoundJson(c);
  return c.json(flattenLatestDeployment(environment));
});
