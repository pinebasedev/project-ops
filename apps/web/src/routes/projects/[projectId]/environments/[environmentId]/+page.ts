import { controlPlane } from "$lib/api/controlPlane";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  return {
    projectId: params.projectId,
    environment: await controlPlane.getEnvironment(params.environmentId),
  };
};
