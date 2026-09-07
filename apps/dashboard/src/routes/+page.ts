import { controlPlane } from "$lib/api/controlPlane";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  return { projects: await controlPlane.listProjects() };
};
