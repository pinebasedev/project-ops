import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const environmentKinds = ["ephemeral", "staging", "production"] as const;
export type EnvironmentKind = (typeof environmentKinds)[number];

export const deploymentStatuses = ["in_progress", "done", "failed"] as const;
export type DeploymentStatus = (typeof deploymentStatuses)[number];

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  tokenHash: text("token_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const environments = sqliteTable(
  "environments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    kind: text("kind", { enum: environmentKinds }).notNull(),
    stageName: text("stage_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex("environments_project_stage_idx").on(table.projectId, table.stageName)],
);

export const deployments = sqliteTable("deployments", {
  id: text("id").primaryKey(),
  environmentId: text("environment_id")
    .notNull()
    .references(() => environments.id),
  status: text("status", { enum: deploymentStatuses }).notNull(),
  commitSha: text("commit_sha").notNull(),
  prNumber: integer("pr_number"),
  previewUrl: text("preview_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Only the relation actually queried (deployment -> its environment, for the
// ownership check in routes/deployments.ts) — no reverse/many relations until
// a route needs one.
export const deploymentsRelations = relations(deployments, ({ one }) => ({
  environment: one(environments, {
    fields: [deployments.environmentId],
    references: [environments.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
