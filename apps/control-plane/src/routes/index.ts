import { Hono } from "hono";
import type { Env } from "../env";
import { health } from "./health";
import { projectRoutes } from "./projects";

export function routes() {
  return new Hono<Env>().route("/", health).route("/projects", projectRoutes);
}
