import { error } from "@sveltejs/kit";
import type { InferResponseType } from "hono/client";
import { api, type ApiClient } from "./client";

// Wire types, taken off the RPC client rather than restated — the control plane
// is the single source of truth for these shapes. `200` strips the error members
// of a route's response union, so callers never narrow an error shape themselves.
export type Project = InferResponseType<ApiClient["v1"]["projects"]["$get"], 200>[number];
export type Environment = InferResponseType<
  ApiClient["v1"]["projects"][":projectId"]["environments"]["$get"],
  200
>[number];
export type EnvironmentDetail = InferResponseType<
  ApiClient["v1"]["environments"][":id"]["$get"],
  200
>;
export type Deployment = NonNullable<Environment["latestDeployment"]>;

export type EnvironmentKind = "ephemeral" | "staging" | "production";

type JsonResponse = { ok: boolean; status: number; json(): Promise<unknown> };

/**
 * Read a success body, or translate the failure. This is the whole HTTP failure
 * protocol, in one place. 401/403 is called out separately because the control
 * plane sits behind Cloudflare Access (ADR-0005): once a session expires the edge
 * answers before the Worker does, and reporting that as "could not reach the API"
 * would send someone debugging the wrong system.
 *
 * The one cast in this module lives here, deliberately. Hono collapses a route's
 * responses into a single `ClientResponse<A | B, 200 | 400>` rather than a union
 * of responses, so `json()` is typed as every status' body at once and no
 * structural check narrows it. `T` is always an `InferResponseType<…, 200>`
 * derived from the control plane itself, so a drifting response shape still
 * breaks the build at the type aliases above — the cast picks a member of the
 * real union, it does not invent one.
 */
async function readOk<T>(res: JsonResponse): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw error(401, "Your Cloudflare Access session has expired — reload to sign in again.");
    }
    throw error(502, "Could not reach the control-plane API");
  }
  return (await res.json()) as T;
}

/**
 * The control plane, as the dashboard uses it: the five reads the views need,
 * with status-code translation and response-union narrowing absorbed.
 *
 * Takes its client rather than importing one, so tests can run it against the
 * real control-plane app in-process (see `controlPlane.test.ts`).
 */
export function createControlPlane(client: ApiClient = api) {
  async function listProjects(): Promise<Project[]> {
    return readOk<Project[]>(await client.v1.projects.$get());
  }

  async function listEnvironments(
    projectId: string,
    kind: EnvironmentKind,
  ): Promise<Environment[]> {
    const res = await client.v1.projects[":projectId"].environments.$get({
      param: { projectId },
      query: { kind },
    });
    return readOk<Environment[]>(res);
  }

  return {
    listProjects,

    // The control plane has no "get one project" route, so this filters the list.
    // Kept behind the same interface a real route would have, so adding one later
    // is an implementation change, not a change at every call site.
    async getProject(projectId: string): Promise<Project> {
      const project = (await listProjects()).find((p) => p.id === projectId);
      if (!project) throw error(404, "Project not found");
      return project;
    },

    listEnvironments,

    /** The single Environment of a kind there can be at most one of. */
    async getEnvironmentOfKind(
      projectId: string,
      kind: Exclude<EnvironmentKind, "ephemeral">,
    ): Promise<Environment | null> {
      const [environment] = await listEnvironments(projectId, kind);
      return environment ?? null;
    },

    async getEnvironment(environmentId: string): Promise<EnvironmentDetail> {
      const res = await client.v1.environments[":id"].$get({ param: { id: environmentId } });
      if (res.status === 404) throw error(404, "Environment not found");
      return readOk<EnvironmentDetail>(res);
    },
  };
}

export type ControlPlane = ReturnType<typeof createControlPlane>;

/** The instance the loaders use, pointed at the deployed control plane. */
export const controlPlane = createControlPlane();
