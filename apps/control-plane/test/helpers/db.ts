import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { join } from "node:path";
import type { Database } from "../../src/db/client";
import { projects } from "../../src/db/schema";
import * as schema from "../../src/db/schema";
import { mintToken } from "../../src/helpers/tokens";

// Resolved against this module, not the working directory: the dashboard's own
// tests import these helpers (via the `control-plane/testing` export) to run the
// real control plane in-process, and their cwd is the other app.
const MIGRATIONS_FOLDER = join(import.meta.dirname, "../../migrations");

// libsql is an async SQLite driver like D1, so its drizzle instance satisfies
// the same `Database` type used against the real D1 binding in production.
export async function createTestDb(): Promise<Database> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

export async function seedProject(
  db: Database,
  overrides: { id?: string; name?: string; githubRepo?: string } = {},
): Promise<{ id: string; name: string; token: string }> {
  const id = overrides.id ?? crypto.randomUUID();
  const name = overrides.name ?? `project-${id}`;
  const { token, tokenHash } = await mintToken();
  await db
    .insert(projects)
    .values({ id, name, tokenHash, githubRepo: overrides.githubRepo ?? null });
  return { id, name, token };
}
