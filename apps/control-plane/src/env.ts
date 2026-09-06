import type { D1Database } from "@cloudflare/workers-types";
import type { Database } from "./db/client";
import type { Project } from "./db/schema";

export type Bindings = {
  DB: D1Database;
};

export type Variables = {
  db: Database;
  project: Project;
};

export type Env = { Bindings: Bindings; Variables: Variables };
