import { controlPlane } from "$lib/api/controlPlane";
import type { PageLoad } from "./$types";

// The production status view — "what commit is currently running in production?"
// There is at most one `production` Environment per Project, tracking `main`.
// Production Deployments are recorded by the promotion CI (staging → main), the
// same way staging ones are; nothing here initiates or gates a promotion
// (ADR-0002).
//
// Known gap (shared with the staging view): only the *latest* Deployment is
// embedded, so a production redeploy in progress replaces the previous one in
// this view until it settles.
export const load: PageLoad = async ({ params }) => {
  const [project, environment] = await Promise.all([
    controlPlane.getProject(params.projectId),
    controlPlane.getEnvironmentOfKind(params.projectId, "production"),
  ]);

  return { project, environment };
};
