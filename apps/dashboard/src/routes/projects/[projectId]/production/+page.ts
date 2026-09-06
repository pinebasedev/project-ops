import { api } from "$lib/api/client";
import { loadProject } from "$lib/api/loadProject";
import { error } from "@sveltejs/kit";
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
  const [project, environmentsRes] = await Promise.all([
    loadProject(params.projectId),
    api.v1.projects[":projectId"].environments.$get({
      param: { projectId: params.projectId },
      query: { kind: "production" },
    }),
  ]);

  if (!environmentsRes.ok) {
    throw error(502, "Could not reach the control-plane API");
  }

  const [environment] = await environmentsRes.json();

  return { project, environment: environment ?? null };
};
