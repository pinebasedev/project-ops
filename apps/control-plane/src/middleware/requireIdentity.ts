import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { unauthorizedJson } from "../helpers/errors";

/**
 * Restricts a route to identity-authenticated callers — the dashboard's
 * founder-only Google login (ADR-0005) — rejecting a service-token-
 * authenticated caller (any managed project's CI) even though both pass the
 * same Access JWT gate (`middleware/accessJwt.ts`).
 *
 * Both `allow-ci` and `allow-team` sit on one Access Application
 * (`alchemy.run.ts`), so Access alone can't tell these two caller kinds
 * apart — only *some* configured policy let the request through. The
 * distinction lives in the already-verified JWT's claims instead: a Google
 * identity login carries an `email` claim; a service-token login doesn't.
 *
 * Applied only to routes that exist for the dashboard, never for CI (the
 * read routes CI has no reason to call) — the bearer-scoped write routes in
 * `routes/deployments.ts` need no equivalent check, since the dashboard has
 * no bearer token and structurally can't call them regardless.
 *
 * A missing `accessJwt` (local `alchemy dev`, ungated — see
 * `accessJwtConfigFromEnv`) passes through unchanged, same as every other
 * ungated-in-dev behavior in this app.
 */
export const requireIdentityMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const jwt = c.get("accessJwt");
  if (jwt && !jwt.email) {
    c.get("logger")?.warn("read rejected", { reason: "service-token caller, identity required" });
    return unauthorizedJson(c);
  }
  await next();
};
