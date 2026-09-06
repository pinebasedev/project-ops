import { Jwt } from "hono/utils/jwt";
import type { HonoJsonWebKey } from "hono/utils/jwt/types";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createTestDb } from "./helpers/db";

describe("createApp", () => {
  it("mounts routes under /v1", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns a sanitized 404 for unknown routes", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not Found" });
  });

  it("applies security headers to every response", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/v1/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  it("tags every response with a request id", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/v1/health");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("does not mount routes outside of /v1", async () => {
    const app = createApp({ db: await createTestDb() });
    const res = await app.request("/health");
    expect(res.status).toBe(404);
  });
});

describe("createApp with the Access gate enabled", () => {
  let publicJwk: HonoJsonWebKey;
  let privateJwk: HonoJsonWebKey;

  beforeAll(async () => {
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
      kid: "k",
      alg: "RS256",
    });
    publicJwk = await exportJwk(publicKey);
    privateJwk = await exportJwk(privateKey);
  });

  const gated = async () =>
    createApp({
      db: await createTestDb(),
      accessJwt: { teamDomain: "pinebase", aud: "aud-tag", keys: [publicJwk] },
    });

  it("leaves /v1/health reachable without an assertion", async () => {
    const res = await (await gated()).request("/v1/health");
    expect(res.status).toBe(200);
  });

  it("rejects other /v1 routes without a valid assertion", async () => {
    const res = await (await gated()).request("/v1/environments/does-not-exist");
    expect(res.status).toBe(401);
  });

  it("admits a request carrying a valid assertion", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await Jwt.sign(
      { iat: now, exp: now + 3600, aud: "aud-tag" },
      privateJwk,
      "RS256",
    );
    const res = await (
      await gated()
    ).request("/v1/environments/does-not-exist", {
      headers: { "Cf-Access-Jwt-Assertion": token },
    });
    expect(res.status).toBe(404);
  });
});
