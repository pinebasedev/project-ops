import { Jwt } from "hono/utils/jwt";
import type { HonoJsonWebKey } from "hono/utils/jwt/types";

// Shared RSA-key + token helpers for the Access-JWT tests. Cloudflare Access
// signs RS256 tokens against the team JWKS; these stand in for that offline.

/** The Access application audience the helpers sign for, unless overridden. */
export const TEST_AUD = "test-aud-tag";

export type Keypair = { publicJwk: HonoJsonWebKey; privateJwk: HonoJsonWebKey };

export async function generateKeypair(kid = "key-1"): Promise<Keypair> {
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
  const toJwk = async (key: CryptoKey): Promise<HonoJsonWebKey> => ({
    ...((await crypto.subtle.exportKey("jwk", key)) as JsonWebKey),
    kid,
    alg: "RS256",
  });
  return { publicJwk: await toJwk(publicKey), privateJwk: await toJwk(privateKey) };
}

// A signed token with sane defaults (valid window, matching aud/iss). Override
// any claim to exercise a rejection path.
export function signAccessToken(
  privateJwk: HonoJsonWebKey,
  claims: Record<string, unknown> = {},
  { teamDomain = "example-team", aud = TEST_AUD }: { teamDomain?: string; aud?: string } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return Jwt.sign(
    {
      iat: now,
      exp: now + 3600,
      aud,
      iss: `https://${teamDomain}.cloudflareaccess.com`,
      ...claims,
    },
    privateJwk,
    "RS256",
  );
}
