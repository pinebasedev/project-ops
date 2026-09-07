import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { createLogger } from "../helpers/logger";

/**
 * Per-request structured logging. Runs right after `requestIdMiddleware`, so it
 * can bind the logger to the request id (also on the `X-Request-Id` header) and
 * stash it on the context — handlers and error handlers reach it with
 * `c.get("logger")`.
 *
 * After the downstream chain resolves it emits one line per request — method,
 * path, status, duration — the control plane's access log. 5xx responses log at
 * `error`, everything else at `info`. Uncaught exceptions are logged separately
 * by `onError` (helpers/errors.ts) before the response is finalized here.
 */
export const loggerMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const requestId = c.get("requestId");
  const logger = createLogger({ requestId });
  c.set("logger", logger);

  const start = Date.now();
  await next();

  const line = {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
  };
  if (c.res.status >= 500) logger.error("request failed", line);
  else logger.info("request", line);
};
