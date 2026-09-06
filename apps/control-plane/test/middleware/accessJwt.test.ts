import { Hono } from "hono";
import { Jwt } from "hono/utils/jwt";
import type { HonoJsonWebKey } from "hono/utils/jwt/types";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/env";
import { accessJwtConfigFromEnv, createAccessJwtMiddleware } from "../../src/middleware/accessJwt";

const AUD = "test-aud-tag";
const HEADER = "Cf-Access-Jwt-Assertion";

type Keypair = { publicJwk: HonoJsonWebKey; privateJwk: HonoJsonWebKey };

async function generateKeypair(kid: string): Promise<Keypair> {
  const { publicKey, privateKey } = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const exportJwk = async (key: CryptoKey): Promise<HonoJsonWebKey> => ({
    ...((await crypto.subtle.exportKey("jwk", key)) as JsonWebKey),
    kid,
    alg: "RS256",
  });
  return { publicJwk: await exportJwk(publicKey), privateJwk: await exportJwk(privateKey) };
}

function sign(privateJwk: HonoJsonWebKey, payload: Record<string, unknown>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return Jwt.sign({ iat: now, exp: now + 3600, aud: AUD, ...payload }, privateJwk, "RS256");
}

/** A tiny app that gates everything behind the middleware under test. */
function gatedApp(keys: HonoJsonWebKey[]) {
  const app = new Hono<Env>();
  app.use("*", createAccessJwtMiddleware({ teamDomain: "pinebase", aud: AUD, keys }));
  app.get("/whoami", (c) => c.json({ email: c.get("accessJwt")?.email ?? null }));
  return app;
}

let keypair: Keypair;
let otherKeypair: Keypair;

beforeAll(async () => {
  keypair = await generateKeypair("key-1");
  otherKeypair = await generateKeypair("key-1");
});

describe("createAccessJwtMiddleware", () => {
  it("rejects a request with no assertion header", async () => {
    const res = await gatedApp([keypair.publicJwk]).request("/whoami");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("accepts a valid token and exposes its payload on the context", async () => {
    const token = await sign(keypair.privateJwk, { email: "oros.stefan18@gmail.com" });
    const res = await gatedApp([keypair.publicJwk]).request("/whoami", {
      headers: { [HEADER]: token },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "oros.stefan18@gmail.com" });
  });

  it("rejects a token signed by a key that isn't in the JWKS", async () => {
    const token = await sign(otherKeypair.privateJwk, { email: "x@y.z" });
    const res = await gatedApp([keypair.publicJwk]).request("/whoami", {
      headers: { [HEADER]: token },
    });
    expect(res.status).toBe(401);
  });

  it("rejects a token issued for a different audience", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await Jwt.sign(
      { iat: now, exp: now + 3600, aud: "some-other-app" },
      keypair.privateJwk,
      "RS256",
    );
    const res = await gatedApp([keypair.publicJwk]).request("/whoami", {
      headers: { [HEADER]: token },
    });
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await Jwt.sign(
      { iat: now - 7200, exp: now - 3600, aud: AUD },
      keypair.privateJwk,
      "RS256",
    );
    const res = await gatedApp([keypair.publicJwk]).request("/whoami", {
      headers: { [HEADER]: token },
    });
    expect(res.status).toBe(401);
  });

  it("fetches the team JWKS once and caches it across requests", async () => {
    const jwks = JSON.stringify({ keys: [keypair.publicJwk] });
    const fetchMock = vi.fn().mockResolvedValue(new Response(jwks, { status: 200 }));
    const app = new Hono<Env>();
    app.use("*", createAccessJwtMiddleware({ teamDomain: "pinebase", aud: AUD, fetch: fetchMock }));
    app.get("/whoami", (c) => c.json({ ok: true }));

    const token = await sign(keypair.privateJwk, {});
    await app.request("/whoami", { headers: { [HEADER]: token } });
    await app.request("/whoami", { headers: { [HEADER]: token } });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://pinebase.cloudflareaccess.com/cdn-cgi/access/certs",
    );
  });
});

describe("accessJwtConfigFromEnv", () => {
  it("returns null unless both the team domain and the aud tag are set", () => {
    expect(accessJwtConfigFromEnv(undefined)).toBeNull();
    expect(accessJwtConfigFromEnv({ CF_ACCESS_TEAM_DOMAIN: "pinebase" })).toBeNull();
    expect(accessJwtConfigFromEnv({ CF_ACCESS_AUD: "aud" })).toBeNull();
  });

  it("builds a config when both are present", () => {
    expect(
      accessJwtConfigFromEnv({ CF_ACCESS_TEAM_DOMAIN: "pinebase", CF_ACCESS_AUD: "aud" }),
    ).toEqual({ teamDomain: "pinebase", aud: "aud" });
  });
});
