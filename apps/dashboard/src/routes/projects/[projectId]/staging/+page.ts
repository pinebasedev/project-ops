import { api } from "$lib/api/client";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// The staging status view. Because promotion (staging → main) is an ungated git
// merge (ADR-0002), this — the current staging Deployment plus its Integration
// Test result — is the signal that stops someone promoting a broken state
// (ADR-0006). There is at most one `staging` Environment per Project.
export const load: PageLoad = async ({ params }) => {
  const [projectsRes, environmentsRes] = await Promise.all([
    api.v1.projects.$get(),
    api.v1.projects[":projectId"].environments.$get({
      param: { projectId: params.projectId },
      query: { kind: "staging" },
    }),
  ]);

  if (!projectsRes.ok || !environmentsRes.ok) {
    throw error(502, "Could not reach the control-plane API");
  }

  const project = (await projectsRes.json()).find((p) => p.id === params.projectId);
  if (!project) {
    throw error(404, "Project not found");
  }

  const [environment] = await environmentsRes.json();

  return { project, environment: environment ?? null };
};
