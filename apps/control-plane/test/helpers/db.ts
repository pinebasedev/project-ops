import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Database } from "../../src/db/client";
import * as schema from "../../src/db/schema";

// libsql is an async SQLite driver like D1, so its drizzle instance satisfies
// the same `Database` type used against the real D1 binding in production.
export async function createTestDb(): Promise<Database> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./migrations" });
  return db;
}
