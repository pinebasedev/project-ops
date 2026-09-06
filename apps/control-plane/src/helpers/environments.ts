import type { Deployment, Environment } from "../db/schema";

export type EnvironmentWithLatestDeployment = Environment & {
  latestDeployment: Deployment | null;
};

// Both query routes fetch an Environment's deployments newest-first, limit 1,
// then collapse that to a single `latestDeployment` field (or null). This keeps
// the embedded shape identical across the list and get-by-id responses.
export function flattenLatestDeployment(
  environment: Environment & { deployments: Deployment[] },
): EnvironmentWithLatestDeployment {
  const { deployments, ...rest } = environment;
  return { ...rest, latestDeployment: deployments[0] ?? null };
}
