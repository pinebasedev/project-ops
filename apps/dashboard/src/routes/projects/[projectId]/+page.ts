import { api } from "$lib/api/client";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// NOTE: every ephemeral Environment the control plane has ever recorded is
// returned here — the platform does not yet track destruction (the merge/destroy
// callback is Phase 1 work still pending in the Svelteflare repo), so a merged
// PR's environment stays listed until that lands.
export const load: PageLoad = async ({ params }) => {
  const [projectsRes, environmentsRes] = await Promise.all([
    api.v1.projects.$get(),
    api.v1.projects[":projectId"].environments.$get({
      param: { projectId: params.projectId },
      query: { kind: "ephemeral" },
    }),
  ]);

  if (!projectsRes.ok || !environmentsRes.ok) {
    throw error(502, "Could not reach the control-plane API");
  }

  const project = (await projectsRes.json()).find((p) => p.id === params.projectId);
  if (!project) {
    throw error(404, "Project not found");
  }

  return { project, environments: await environmentsRes.json() };
};
