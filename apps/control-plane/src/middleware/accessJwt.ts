import type { MiddlewareHandler } from "hono";
import { Jwt } from "hono/utils/jwt";
import type { HonoJsonWebKey } from "hono/utils/jwt/types";
import type { Bindings, Env } from "../env";
import { unauthorizedJson } from "../helpers/errors";

// Cloudflare Access puts the signed identity assertion here, as a bare JWT with
// no `Bearer` prefix — so `hono/jwk` (which insists on `Authorization: Bearer`)
// doesn't fit; we drive `Jwt.verifyWithJwks` directly.
export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
const JWKS_TTL_MS = 60 * 60 * 1000;

export type AccessJwtConfig = {
  /** Zero Trust team subdomain — `<team>.cloudflareaccess.com`. */
  teamDomain: string;
  /** The Access application's audience (AUD) tag; every token must carry it. */
  aud: string;
  /** Test seam: pre-supplied public keys, skipping the JWKS fetch entirely. */
  keys?: HonoJsonWebKey[];
  /** Test seam: injected `fetch` for the JWKS request. */
  fetch?: typeof fetch;
};

/**
 * Verifies the `Cf-Access-Jwt-Assertion` header against the Zero Trust team's
 * JWKS — defense in depth, independent of the edge Access gate (ADR-0005). Any
 * missing, malformed, mis-audienced, expired, or wrongly-signed token is a 401.
 *
 * The team JWKS is fetched on first use and cached per {@link JWKS_TTL_MS} for
 * the isolate's lifetime, so steady-state requests verify without a round trip.
 */
export function createAccessJwtMiddleware(config: AccessJwtConfig): MiddlewareHandler<Env> {
  // The team's Zero Trust origin: the `iss` every token must carry, and the host
  // its signing keys are published under.
  const teamOrigin = `https://${config.teamDomain}.cloudflareaccess.com`;
  const jwksUri = `${teamOrigin}/cdn-cgi/access/certs`;
  const doFetch = config.fetch ?? fetch;
  let cache: { keys: HonoJsonWebKey[]; expiresAt: number } | undefined;

  async function keys(): Promise<HonoJsonWebKey[]> {
    if (config.keys) return config.keys;
    if (cache && cache.expiresAt > Date.now()) return cache.keys;
    const response = await doFetch(jwksUri);
    if (!response.ok) throw new Error(`JWKS fetch failed (${response.status})`);
    const body = (await response.json()) as { keys?: HonoJsonWebKey[] };
    if (!body.keys) throw new Error("JWKS response has no `keys`");
    cache = { keys: body.keys, expiresAt: Date.now() + JWKS_TTL_MS };
    return body.keys;
  }

  return async (c, next) => {
    const token = c.req.header(ACCESS_JWT_HEADER);
    if (!token) {
      c.get("logger")?.warn("access assertion rejected", { reason: "missing assertion header" });
      return unauthorizedJson(c);
    }

    try {
      const payload = await Jwt.verifyWithJwks(token, {
        keys: await keys(),
        verification: { aud: config.aud, iss: teamOrigin },
        allowedAlgorithms: ["RS256"],
      });
      c.set("accessJwt", payload);
    } catch (err) {
      c.get("logger")?.warn("access assertion rejected", { reason: "verification failed", err });
      return unauthorizedJson(c);
    }

    await next();
  };
}

/**
 * Builds the middleware config from the Worker bindings, or null when either
 * value is absent — local `alchemy dev` runs ungated (mirrors
 * `observabilityFromEnv`); deployed stacks always set both (ADR-0009).
 */
export function accessJwtConfigFromEnv(
  env: Partial<Bindings> | undefined,
): Pick<AccessJwtConfig, "teamDomain" | "aud"> | null {
  if (!env?.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;
  return { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, aud: env.CF_ACCESS_AUD };
}
