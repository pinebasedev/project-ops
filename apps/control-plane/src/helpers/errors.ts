import type { Context, ErrorHandler, NotFoundHandler } from "hono";

export const onError: ErrorHandler = (err, c) => {
  console.error(err);
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
