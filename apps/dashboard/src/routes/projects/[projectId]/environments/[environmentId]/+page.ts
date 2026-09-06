import { api } from "$lib/api/client";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const res = await api.v1.environments[":id"].$get({
    param: { id: params.environmentId },
  });

  if (res.status === 404) {
    throw error(404, "Environment not found");
  }
  if (!res.ok) {
    throw error(502, "Could not reach the control-plane API");
  }

  const body = await res.json();
  if ("error" in body) {
    throw error(404, "Environment not found");
  }

  return { projectId: params.projectId, environment: body };
};
