import { error } from "@sveltejs/kit";
import { api } from "./client";

// The control plane has no "get one project" route yet, so every project-scoped
// page resolves its Project by filtering the list. Shared here so the 502/404
// handling stays identical across those loaders.
export async function loadProject(projectId: string) {
  const res = await api.v1.projects.$get();
  if (!res.ok) {
    throw error(502, "Could not reach the control-plane API");
  }

  const project = (await res.json()).find((p) => p.id === projectId);
  if (!project) {
    throw error(404, "Project not found");
  }
  return project;
}
