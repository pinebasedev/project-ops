import { Hono } from "hono";
import { notFound, onError } from "./helpers/errors";
import { requestIdMiddleware, secureHeadersMiddleware } from "./middleware";
import { routes } from "./routes";

// Later phases inject dependencies here (e.g. a db client for tests);
// the parameter exists now so callers already go through the factory.
export type AppOverrides = Record<string, never>;

export function createApp(_overrides: AppOverrides = {}) {
  const app = new Hono();

  app.use("*", requestIdMiddleware);
  app.use("*", secureHeadersMiddleware);

  app.route("/v1", routes());

  app.notFound(notFound);
  app.onError(onError);

  return app;
}

export type AppType = ReturnType<typeof createApp>;
