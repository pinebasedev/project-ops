import { Hono } from "hono";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/env";
import { loggerMiddleware } from "../../src/middleware/logger";
import {
  ACCESS_JWT_HEADER,
  accessJwtConfigFromEnv,
  createAccessJwtMiddleware,
} from "../../src/middleware/accessJwt";
import { generateKeypair, signAccessToken, TEST_AUD, type Keypair } from "../helpers/accessJwt";

/** A tiny app that gates everything behind the middleware under test. */
function gatedApp(keys: Keypair["publicJwk"][]) {
  const app = new Hono<Env>();
  app.use("*", createAccessJwtMiddleware({ teamDomain: "example-team", aud: TEST_AUD, keys }));
  app.get("/whoami", (c) => c.json({ email: c.get("accessJwt")?.email ?? null }));
  return app;
}

let keypair: Keypair;
let otherKeypair: Keypair;

beforeAll(async () => {
  keypair = await generateKeypair();
  otherKeypair = await generateKeypair();
});

describe("createAccessJwtMiddleware", () => {
  it("rejects a request with no assertion header", async () => {
    const res = await gatedApp([keypair.publicJwk]).request("/whoami");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("accepts a valid token and exposes its payload on the context", async () => {
    const token = await signAccessToken(keypair.privateJwk, { email: "user@example.com" });
    const res = await gatedApp([keypair.publicJwk]).request("/whoami", {
      headers: { [ACCESS_JWT_HEADER]: token },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "user@example.com" });
  });

  it("rejects a token signed by a key that isn't in the JWKS", async () => {
    const token = await signAccessToken(otherKeypair.privateJwk);
    const res = await gatedApp([keypair.publicJwk]).request("/whoami", {
      headers: { [ACCESS_JWT_HEADER]: token },
    });
    expect(res.status).toBe(401);
  });

  it("rejects a token issued for a different audience", async () => {
    const token = await signAccessToken(keypair.privateJwk, { aud: "some-other-app" });
    const res = await gatedApp([keypair.publicJwk]).request("/whoami", {
      headers: { [ACCESS_JWT_HEADER]: token },
    });
    expect(res.status).toBe(401);
  });

  it("rejects a token issued by a different Zero Trust team", async () => {
    const token = await signAccessToken(keypair.privateJwk, {
      iss: "https://someone-else.cloudflareaccess.com",
    });
    const res = await gatedApp([keypair.publicJwk]).request("/whoami", {
      headers: { [ACCESS_JWT_HEADER]: token },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signAccessToken(keypair.privateJwk, { iat: now - 7200, exp: now - 3600 });
    const res = await gatedApp([keypair.publicJwk]).request("/whoami", {
      headers: { [ACCESS_JWT_HEADER]: token },
    });
    expect(res.status).toBe(401);
  });

  it("fetches the team JWKS once and caches it across requests", async () => {
    const jwks = JSON.stringify({ keys: [keypair.publicJwk] });
    const fetchMock = vi.fn().mockResolvedValue(new Response(jwks, { status: 200 }));
    const app = new Hono<Env>();
    app.use(
      "*",
      createAccessJwtMiddleware({ teamDomain: "example-team", aud: TEST_AUD, fetch: fetchMock }),
    );
    app.get("/whoami", (c) => c.json({ ok: true }));

    const token = await signAccessToken(keypair.privateJwk);
    await app.request("/whoami", { headers: { [ACCESS_JWT_HEADER]: token } });
    await app.request("/whoami", { headers: { [ACCESS_JWT_HEADER]: token } });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://example-team.cloudflareaccess.com/cdn-cgi/access/certs",
    );
  });

  it("never logs the raw token on a rejected assertion", async () => {
    // Hono's JWT errors interpolate the raw token into `.message` (e.g.
    // `token (${token}) expired`) — this guards against that ever reaching logs.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = new Hono<Env>();
    app.use("*", loggerMiddleware);
    app.use(
      "*",
      createAccessJwtMiddleware({
        teamDomain: "example-team",
        aud: TEST_AUD,
        keys: [keypair.publicJwk],
      }),
    );
    app.get("/whoami", (c) => c.json({ ok: true }));

    const now = Math.floor(Date.now() / 1000);
    const token = await signAccessToken(keypair.privateJwk, { iat: now - 7200, exp: now - 3600 });
    const res = await app.request("/whoami", { headers: { [ACCESS_JWT_HEADER]: token } });

    expect(res.status).toBe(401);
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain(token);
    for (const segment of token.split(".")) expect(logged).not.toContain(segment);
    consoleError.mockRestore();
  });
});

describe("accessJwtConfigFromEnv", () => {
  it("returns null unless both the team domain and the aud tag are set", () => {
    expect(accessJwtConfigFromEnv(undefined)).toBeNull();
    expect(accessJwtConfigFromEnv({ CF_ACCESS_TEAM_DOMAIN: "example-team" })).toBeNull();
    expect(accessJwtConfigFromEnv({ CF_ACCESS_AUD: "aud" })).toBeNull();
  });

  it("builds a config when both are present", () => {
    expect(
      accessJwtConfigFromEnv({ CF_ACCESS_TEAM_DOMAIN: "example-team", CF_ACCESS_AUD: "aud" }),
    ).toEqual({ teamDomain: "example-team", aud: "aud" });
  });
});
