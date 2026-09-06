import { Hono } from "hono";
import type { Env } from "../env";
import { deploymentRoutes } from "./deployments";
import { health } from "./health";
import { projectRoutes } from "./projects";

export function routes() {
  return new Hono<Env>()
    .route("/", health)
    .route("/projects", projectRoutes)
    .route("/deployments", deploymentRoutes);
}
