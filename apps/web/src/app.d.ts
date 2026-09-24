import type { Bindings } from "api/env";
import type { IncomingRequestCfProperties } from "@cloudflare/workers-types";

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // Matches what Alchemy's generated Worker shim actually populates
    // (`@alchemy.run/frontend-frameworks/src/sveltekit/WorkerShim.ts`:
    // `platform: { env, ctx, caches, cf: req.cf }`).
    interface Platform {
      env: Bindings;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }
  }
}

export {};
