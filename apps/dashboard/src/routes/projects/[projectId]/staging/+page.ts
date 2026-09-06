import { api } from "$lib/api/client";
import { loadProject } from "$lib/api/loadProject";
import { error } from "@sveltejs/kit";
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
  const [project, environmentsRes] = await Promise.all([
    loadProject(params.projectId),
    api.v1.projects[":projectId"].environments.$get({
      param: { projectId: params.projectId },
      query: { kind: "staging" },
    }),
  ]);

  if (!environmentsRes.ok) {
    throw error(502, "Could not reach the control-plane API");
  }

  const [environment] = await environmentsRes.json();

  return { project, environment: environment ?? null };
};
