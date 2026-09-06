import { drizzle } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema";

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

// Structural type shared with the libsql-backed test double in test/helpers/db.ts —
// both drivers are async SQLite implementations of the same schema, so route code
// can depend on this instead of the D1-specific driver class.
export type Database = BaseSQLiteDatabase<"async", unknown, typeof schema>;
