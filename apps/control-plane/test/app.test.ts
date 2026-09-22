import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { ACCESS_JWT_HEADER } from "../src/middleware/accessJwt";
import { generateKeypair, signAccessToken, TEST_AUD, type Keypair } from "./helpers/accessJwt";
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
  let keypair: Keypair;

  beforeAll(async () => {
    keypair = await generateKeypair();
  });

  const gated = async () =>
    createApp({
      db: await createTestDb(),
      accessJwt: { teamDomain: "pinebase", aud: TEST_AUD, keys: [keypair.publicJwk] },
    });

  it("leaves /v1/health reachable without an assertion", async () => {
    const res = await (await gated()).request("/v1/health");
    expect(res.status).toBe(200);
  });

  it("rejects other /v1 routes without a valid assertion", async () => {
    const res = await (await gated()).request("/v1/environments/does-not-exist");
    expect(res.status).toBe(401);
  });

  it("admits an identity-authenticated request carrying a valid assertion", async () => {
    const token = await signAccessToken(keypair.privateJwk, { email: "oros.stefan18@gmail.com" });
    const res = await (
      await gated()
    ).request("/v1/environments/does-not-exist", {
      headers: { [ACCESS_JWT_HEADER]: token },
    });
    expect(res.status).toBe(404);
  });

  // requireIdentityMiddleware (ADR-0005 update): a valid Access assertion
  // alone isn't enough for these read routes — a service-token-authenticated
  // caller (any managed project's CI, sharing one Access token) is past the
  // base gate but still rejected, so it can't read another project's data.
  it("rejects a service-token-authenticated request on a dashboard-only read", async () => {
    const token = await signAccessToken(keypair.privateJwk); // no `email` claim
    const app = await gated();

    const list = await app.request("/v1/projects", { headers: { [ACCESS_JWT_HEADER]: token } });
    expect(list.status).toBe(401);

    const byId = await app.request("/v1/environments/does-not-exist", {
      headers: { [ACCESS_JWT_HEADER]: token },
    });
    expect(byId.status).toBe(401);
  });

  it("admits an identity-authenticated request on a dashboard-only read", async () => {
    const token = await signAccessToken(keypair.privateJwk, { email: "oros.stefan18@gmail.com" });
    const res = await (
      await gated()
    ).request("/v1/projects", {
      headers: { [ACCESS_JWT_HEADER]: token },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
