import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { projects } from "../db/schema";
import type { Env } from "../env";
import { unauthorizedJson } from "../helpers/errors";
import { hashToken } from "../helpers/tokens";

const BEARER_PREFIX = "Bearer ";

export const bearerAuthMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    c.get("logger")?.warn("bearer auth rejected", { reason: "missing or malformed header" });
    return unauthorizedJson(c);
  }

  const token = header.slice(BEARER_PREFIX.length);
  const tokenHash = await hashToken(token);
  const project = await c.get("db").query.projects.findFirst({
    where: eq(projects.tokenHash, tokenHash),
  });

  if (!project) {
    c.get("logger")?.warn("bearer auth rejected", { reason: "unknown token" });
    return unauthorizedJson(c);
  }

  c.set("project", project);
  await next();
};
