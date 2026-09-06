import { api } from "$lib/api/client";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const res = await api.v1.projects.$get();
  if (!res.ok) {
    throw error(502, "Could not reach the control-plane API");
  }
  return { projects: await res.json() };
};
