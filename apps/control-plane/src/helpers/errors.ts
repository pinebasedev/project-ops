import type { ErrorHandler, NotFoundHandler } from "hono";

export const onError: ErrorHandler = (err, c) => {
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
};

export const notFound: NotFoundHandler = (c) => {
  return c.json({ error: "Not Found" }, 404);
};
