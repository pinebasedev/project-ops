import * as Cloudflare from "alchemy/Cloudflare";

/**
 * The control-plane's D1 database (`DB` binding).
 *
 * `migrations` points at the existing drizzle-kit output. Alchemy sorts the
 * `.sql` files by numeric prefix and applies pending ones on every deploy
 * (P6-01's "apply the control-plane's D1 migrations on deploy"), adopting a
 * database previously migrated with `wrangler d1 migrations apply` via a
 * one-way conversion on first run.
 */
export const Database = Cloudflare.D1.Database("control-plane-db", {
  migrations: "./apps/control-plane/migrations",
});
