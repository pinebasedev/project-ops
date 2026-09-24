import * as Cloudflare from "alchemy/Cloudflare";

/**
 * The control plane's D1 database (`DB` binding).
 *
 * `migrations` points at the existing drizzle-kit output. Alchemy sorts the
 * `.sql` files by numeric prefix and applies pending ones on every deploy, adopting a
 * database previously migrated with `wrangler d1 migrations apply` via a
 * one-way conversion on first run.
 *
 * `name` is pinned explicitly: the first argument ("db") is only Alchemy's
 * internal logical resource id, and left unset Alchemy would generate a
 * machine/stage-specific physical name. A managed project's credential
 * bootstrap stack (ADR-0010) writes to this database with a plain
 * `wrangler d1 execute <name> --remote`, which can't resolve an Alchemy
 * resource, so it needs a stable, predictable name.
 */
export const Database = Cloudflare.D1.Database("db", {
  name: "production-project-ops-db",
  migrations: "./apps/api/migrations",
});
