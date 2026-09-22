import { defineRelations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const environmentKinds = ["ephemeral", "staging", "production"] as const;
export type EnvironmentKind = (typeof environmentKinds)[number];

export const deploymentStatuses = ["in_progress", "done", "failed"] as const;
export type DeploymentStatus = (typeof deploymentStatuses)[number];

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  tokenHash: text("token_hash").notNull(),
  // GitHub repo the Project's commits live in, as an `owner/repo` slug. Used
  // only to build link-outs to GitHub's own compare view for Deployment diffs
  // (ADR-0007) — the control plane never calls the GitHub API. Nullable: a
  // Project registered without one just doesn't get diff links.
  githubRepo: text("github_repo"),
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
  // Aggregate Integration Test outcome for this Deployment, reported by the
  // managed project's CI after the live suite runs against staging. Counts only,
  // plus a link to the Actions run — no per-test detail (ADR-0007). Null until
  // results are reported (and always null for ephemeral Deployments, which don't
  // run Integration Tests — ADR-0006).
  integrationTestsPassed: integer("integration_tests_passed"),
  integrationTestsFailed: integer("integration_tests_failed"),
  integrationTestsRunUrl: text("integration_tests_run_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

const tables = { projects, environments, deployments };

// The reverse side (environments.deployments), used by the query routes to
// embed an Environment's latest Deployment (status, commit, preview URL)
// alongside the Environment row.
export const dbRelations = defineRelations(tables, (r) => ({
  deployments: {
    environment: r.one.environments({
      from: r.deployments.environmentId,
      to: r.environments.id,
      optional: false,
    }),
  },
  environments: {
    deployments: r.many.deployments(),
  },
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
