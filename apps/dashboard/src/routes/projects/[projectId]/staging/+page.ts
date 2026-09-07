import { controlPlane } from "$lib/api/controlPlane";
import type { PageLoad } from "./$types";

// The staging status view. Because promotion (staging → main) is an ungated git
// merge (ADR-0002), this — the current staging Deployment plus its Integration
// Test result — is the signal that stops someone promoting a broken state
// (ADR-0006). There is at most one `staging` Environment per Project.
//
// Known gap: only the *latest* Deployment is embedded, so while a staging
// redeploy is in progress its (not-yet-run) Integration Test result replaces the
// previous one in the view. Surfacing the last reported result across redeploys
// needs a control-plane query this phase doesn't add.
export const load: PageLoad = async ({ params }) => {
  const [project, environment, production] = await Promise.all([
    controlPlane.getProject(params.projectId),
    controlPlane.getEnvironmentOfKind(params.projectId, "staging"),
    controlPlane.getEnvironmentOfKind(params.projectId, "production"),
  ]);

  // The production Deployment the "compare with production" link diffs against
  // (P4-04) — "what would promoting staging ship?". Null until production has
  // ever deployed.
  return {
    project,
    environment,
    productionDeployment: production?.latestDeployment ?? null,
  };
};
