import { controlPlane } from "$lib/api/controlPlane";
import type { PageLoad } from "./$types";

// NOTE: every ephemeral Environment the control plane has ever recorded is
// returned here — the platform does not yet track destruction (the merge/destroy
// callback is Phase 1 work still pending in the Svelteflare repo), so a merged
// PR's environment stays listed until that lands.
export const load: PageLoad = async ({ params }) => {
  const [project, environments] = await Promise.all([
    controlPlane.getProject(params.projectId),
    controlPlane.listEnvironments(params.projectId, "ephemeral"),
  ]);

  return { project, environments };
};
