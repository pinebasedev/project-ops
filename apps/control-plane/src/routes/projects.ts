import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { environmentKinds } from "../db/schema";
import type { Env } from "../env";
import { flattenLatestDeployment, withLatestDeployment } from "../helpers/environments";
import { requireIdentityMiddleware } from "../middleware/requireIdentity";

const listEnvironmentsQuerySchema = z.object({ kind: z.enum(environmentKinds).optional() });

// No registration route here: a project's row and its bearer-token hash are
// written directly into this D1 database by each managed project's own
// bootstrap stack (`alchemy/github.ts`, run once by hand), not minted by
// calling this API — see ADR-0010. That
// keeps this API's token-issuance surface at zero: no route here can mint or
// overwrite a project's credential, for any caller.
//
// Both routes below exist for the dashboard, never CI — `requireIdentityMiddleware`
// rejects a service-token caller even though it's past the Access gate (ADR-0005
// update); otherwise any managed project's CI could read every other project's
// data through the one shared Access service token.
export const projectRoutes = new Hono<Env>()
  .get("/", requireIdentityMiddleware, async (c) => {
    const rows = await c.get("db").query.projects.findMany({
      columns: { tokenHash: false },
      orderBy: { createdAt: "desc" },
    });
    return c.json(rows);
  })
  .get(
    "/:projectId/environments",
    requireIdentityMiddleware,
    zValidator("query", listEnvironmentsQuerySchema),
    async (c) => {
      const { projectId } = c.req.param();
      const { kind } = c.req.valid("query");

      const rows = await c.get("db").query.environments.findMany({
        where: kind ? { projectId, kind } : { projectId },
        with: withLatestDeployment,
      });

      return c.json(rows.map(flattenLatestDeployment));
    },
  );
