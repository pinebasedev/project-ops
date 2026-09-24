import { defineConfig } from "vitest/config";

// The unit suite runs in plain Node against an in-memory libsql DB (see
// test/helpers/db.ts) — no `@cloudflare/vite-plugin` / workerd. Local dev and
// deploy both go through Alchemy (`../../alchemy.run.ts`, ADR-0009).
export default defineConfig({
  test: {
    expect: { requireAssertions: true },
  },
});
