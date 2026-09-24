import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { createLogger, type Logger } from "./logger";

export const onError: ErrorHandler = (err, c) => {
  // `loggerMiddleware` runs first, so the bound logger is normally set; fall
  // back to a bare one if the error was thrown before it ran (or in a test
  // mounting this handler on a bare app).
  const logger =
    (c.get("logger") as Logger | undefined) ?? createLogger({ requestId: c.get("requestId") });
  logger.error("unhandled exception", { err, method: c.req.method, path: c.req.path });
  return c.json({ error: "Internal Server Error" }, 500);
};

export const notFound: NotFoundHandler = (c) => {
  return c.json({ error: "Not Found" }, 404);
};

// Same response shapes as `notFound`/onError above, for handlers that need to
// return them explicitly rather than falling through to the app-level handler.
export function notFoundJson(c: Context) {
  return c.json({ error: "Not Found" }, 404);
}

export function unauthorizedJson(c: Context) {
  return c.json({ error: "Unauthorized" }, 401);
}
