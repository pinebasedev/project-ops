import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Output from "alchemy/Output";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { accessResources } from "./alchemy/Access.ts";
import { Database } from "./alchemy/Db.ts";
import { controlPlaneApiToken } from "./alchemy/Secrets.ts";

/**
 * The platform provisioning its own infrastructure (Phase 6, P6-01/02/04). One
 * Alchemy stage, `prod` — the control-plane and dashboard are deployed for the
 * first time here, already behind Cloudflare Access, never before (see
 * docs/adr/0009 and docs/ROADMAP.md's sequencing assumptions).
 *
 * State: local filesystem for `alchemy dev` / manual runs; the Cloudflare-backed
 * remote state store in CI, where the runner has no persistent filesystem.
 *
 * Not yet proven with a real `alchemy deploy` — that, the Zero Trust org + Google
 * IdP, and the end-to-end check (P6-06) are driven by scripts/phase-6-deploy.sh.
 */
export default Alchemy.Stack(
  "cloudflare-idp",
  {
    providers: Layer.mergeAll(Cloudflare.providers()),
    state: process.env.CI ? Cloudflare.state() : Alchemy.localState(),
  },
  Effect.gen(function* () {
    const database = yield* Database;
    const apiToken = yield* controlPlaneApiToken;
    const { serviceToken, allowTeam, allowCi } = yield* accessResources;

    // UUID of the Google identity provider configured in the Zero Trust org.
    // Supplied via the deploy wizard; the dev fallback keeps `alchemy dev` happy.
    const googleIdpId = yield* Config.string("CF_GOOGLE_IDP_ID").pipe(
      Config.withDefault("dev-google-idp"),
    );
    const accessTeamDomain = yield* Config.string("CF_ACCESS_TEAM_DOMAIN").pipe(
      Config.withDefault("dev-team"),
    );

    // Explicit application (rather than the inline `access: { policies }` form)
    // so its AUD tag can be wired back into the Worker for server-side JWT
    // verification (P6-03).
    const controlPlaneApp = yield* Cloudflare.Access.Application("control-plane-access", {
      type: "self_hosted",
      name: "cloudflare-idp control-plane API",
      policies: [allowCi],
      allowedIdps: [googleIdpId],
    });

    const controlPlane = yield* Cloudflare.Worker("control-plane", {
      main: "./apps/control-plane/src/index.ts",
      compatibility: { flags: ["nodejs_compat"], date: "2026-09-05" },
      access: controlPlaneApp,
      env: {
        DB: database,
        CLOUDFLARE_API_TOKEN: apiToken,
        CLOUDFLARE_ACCOUNT_ID: Config.string("CLOUDFLARE_ACCOUNT_ID").pipe(
          Config.withDefault("dev-account"),
        ),
        CF_ACCESS_TEAM_DOMAIN: accessTeamDomain,
        CF_ACCESS_AUD: controlPlaneApp.aud,
      },
    });

    const dashboard = yield* Cloudflare.Website.SvelteKit("dashboard", {
      rootDir: "./apps/dashboard",
      access: {
        policies: [allowTeam],
        allowedIdps: [googleIdpId],
        autoRedirectToIdentity: true,
      },
      env: {
        PUBLIC_CONTROL_PLANE_URL: Output.interpolate`${controlPlane.url}`,
      },
    });

    return {
      controlPlaneUrl: controlPlane.url,
      dashboardUrl: dashboard.url,
      // Paste these into the deploy wizard when it asks.
      accessAud: controlPlaneApp.aud,
      serviceTokenClientId: serviceToken.clientId,
    };
  }),
);
