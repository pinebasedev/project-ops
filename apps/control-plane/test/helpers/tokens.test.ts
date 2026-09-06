import { describe, expect, it } from "vitest";
import { hashToken, mintToken } from "../../src/helpers/tokens";

describe("mintToken", () => {
  it("returns a raw token and its hash", async () => {
    const { token, tokenHash } = await mintToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("mints a different token (and hash) each time", async () => {
    const a = await mintToken();
    const b = await mintToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("hashToken", () => {
  it("is deterministic", async () => {
    const { token, tokenHash } = await mintToken();
    expect(await hashToken(token)).toBe(tokenHash);
  });

  it("produces different hashes for different tokens", async () => {
    expect(await hashToken("token-a")).not.toBe(await hashToken("token-b"));
  });
});
