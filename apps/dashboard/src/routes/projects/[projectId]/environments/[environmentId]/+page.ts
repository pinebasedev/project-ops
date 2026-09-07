import { controlPlane } from "$lib/api/controlPlane";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  return {
    projectId: params.projectId,
    environment: await controlPlane.getEnvironment(params.environmentId),
    // Streamed, not awaited: the errors panel hangs off a live Telemetry query
    // (ADR-0004) that can be slow or unavailable, and shouldn't hold up the page.
    recentErrors: controlPlane.recentErrors(params.environmentId),
  };
};
