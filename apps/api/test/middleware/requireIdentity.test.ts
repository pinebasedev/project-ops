import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { Env, Variables } from "../../src/env";
import { requireIdentityMiddleware } from "../../src/middleware/requireIdentity";

/** A tiny app that lets each request set its own `accessJwt` context value
 * directly — isolates this middleware from the real JWT verification, which
 * `accessJwt.test.ts` already covers on its own. */
function appWithAccessJwt(accessJwt: Variables["accessJwt"]) {
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.set("accessJwt", accessJwt);
    await next();
  });
  app.get("/whoami", requireIdentityMiddleware, (c) => c.json({ ok: true }));
  return app;
}

describe("requireIdentityMiddleware", () => {
  it("passes through when no Access JWT is set (ungated local dev)", async () => {
    const res = await appWithAccessJwt(undefined).request("/whoami");
    expect(res.status).toBe(200);
  });

  it("rejects an Access JWT with no email claim (a service-token caller)", async () => {
    const res = await appWithAccessJwt({ aud: "some-aud" }).request("/whoami");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("admits an Access JWT with an email claim (an identity login)", async () => {
    const res = await appWithAccessJwt({ email: "user@example.com" }).request("/whoami");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
