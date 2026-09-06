import { desc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { deployments, environments, type Deployment, type Environment } from "../db/schema";

export type EnvironmentWithLatestDeployment = Environment & {
  latestDeployment: Deployment | null;
};

// The single Environment lookup both `/environments/:id` routes need: the row
// plus its most recent Deployment, or `undefined` when the id is unknown.
export function findEnvironmentWithLatestDeployment(db: Database, id: string) {
  return db.query.environments.findFirst({
    where: eq(environments.id, id),
    with: withLatestDeployment,
  });
}

// Relational-query fragment shared by both query routes: fetch only an
// Environment's most recent Deployment. `createdAt` is second-granularity, so
// `id` is a deterministic (if arbitrary) tie-breaker for same-second redeploys.
export const withLatestDeployment = {
  deployments: {
    orderBy: [desc(deployments.createdAt), desc(deployments.id)],
    limit: 1,
  },
};

// Collapse the `deployments` array (0 or 1 rows) that `withLatestDeployment`
// produces into a single `latestDeployment` field, so the list and get-by-id
// responses share one shape.
export function flattenLatestDeployment(
  environment: Environment & { deployments: Deployment[] },
): EnvironmentWithLatestDeployment {
  const { deployments: rows, ...rest } = environment;
  return { ...rest, latestDeployment: rows[0] ?? null };
}
