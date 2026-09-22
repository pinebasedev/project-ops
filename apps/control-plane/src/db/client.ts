import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import type { SQLiteAsyncDatabase } from "drizzle-orm/sqlite-core";
import { dbRelations } from "./schema";

export function createDb(d1: D1Database) {
  return drizzle(d1, { relations: dbRelations });
}

// Structural type shared with the libsql-backed test double in test/helpers/db.ts —
// both drivers are async SQLite implementations of the same schema, so route code
// can depend on this instead of the D1-specific driver class.
export type Database = SQLiteAsyncDatabase<"async", unknown, typeof dbRelations>;
