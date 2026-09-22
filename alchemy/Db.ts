import * as Cloudflare from "alchemy/Cloudflare";

/**
 * The control-plane's D1 database (`DB` binding).
 *
 * `migrations` points at the existing drizzle-kit output. Alchemy sorts the
 * `.sql` files by numeric prefix and applies pending ones on every deploy
 * (P6-01's "apply the control-plane's D1 migrations on deploy"), adopting a
 * database previously migrated with `wrangler d1 migrations apply` via a
 * one-way conversion on first run.
 *
 * `name` is pinned explicitly: the first argument ("control-plane-db") is
 * only Alchemy's own internal logical resource id, not the actual Cloudflare
 * database name — left unset, Alchemy auto-generates a machine/stage-specific
 * physical name (e.g. `cloudflare-idp-control-plane-db-live-<user>-<random>`)
 * instead. demo-project's bootstrap stack (`alchemy/github.ts`) shells out to
 * `wrangler d1 execute control-plane-db --remote` directly — it has to assume
 * a stable, predictable name since it isn't itself an Alchemy resource that
 * could resolve the real one, so this pins Cloudflare's own database name to
 * match.
 */
export const Database = Cloudflare.D1.Database("control-plane-db", {
  name: "production-control-plane-db",
  migrations: "./apps/control-plane/migrations",
});
