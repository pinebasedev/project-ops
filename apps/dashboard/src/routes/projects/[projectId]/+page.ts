import { api } from "$lib/api/client";
import { loadProject } from "$lib/api/loadProject";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// NOTE: every ephemeral Environment the control plane has ever recorded is
// returned here — the platform does not yet track destruction (the merge/destroy
// callback is Phase 1 work still pending in the Svelteflare repo), so a merged
// PR's environment stays listed until that lands.
export const load: PageLoad = async ({ params }) => {
  const [project, environmentsRes] = await Promise.all([
    loadProject(params.projectId),
    api.v1.projects[":projectId"].environments.$get({
      param: { projectId: params.projectId },
      query: { kind: "ephemeral" },
    }),
  ]);

  if (!environmentsRes.ok) {
    throw error(502, "Could not reach the control-plane API");
  }

  return { project, environments: await environmentsRes.json() };
};
