import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { redactedOr } from "./config.ts";

/**
 * The control-plane's own operational secret — the Cloudflare API token it uses
 * to query the Workers Observability Telemetry API (ADR-0004) — stored in the
 * account's single Cloudflare Secrets Store rather than as a plain Worker secret
 * (ADR-0005, P6-04).
 *
 * Bound into the control-plane Worker's `env`, where at runtime it is a
 * `SecretsStoreSecret` read with `.get()` (see the control-plane's
 * `helpers/secrets.ts`). The value comes from `CLOUDFLARE_API_TOKEN` in CI env /
 * a local `.env`; the dev fallback lets `alchemy dev` run without it.
 *
 * `SecretsStore.Store` adopts the account's existing store (Cloudflare allows
 * one per account) and never deletes it on teardown.
 */
export const controlPlaneApiToken = Effect.gen(function* () {
  const store = yield* Cloudflare.SecretsStore.Store("idp-secrets");
  const value = yield* redactedOr("CLOUDFLARE_API_TOKEN", "dev-only-cloudflare-api-token");
  return yield* Cloudflare.SecretsStore.Secret("CLOUDFLARE_API_TOKEN", { store, value });
});
