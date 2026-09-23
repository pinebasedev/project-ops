import { createApp } from "control-plane/app";
import type { RequestHandler } from "./$types";

// Mounts the control-plane's Hono app in-Worker, at the same origin as the
// dashboard pages (see ADR-0009's merge update). `fallback` catches every
// HTTP method Hono's routes use, so this one handler is the whole mount —
// no per-verb GET/POST/... exports needed.
const app = createApp();

export const fallback: RequestHandler = ({ request, platform }) =>
  app.fetch(request, platform?.env, platform?.ctx);
