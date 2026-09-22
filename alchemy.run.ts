import * as Alchemy from "alchemy";
import { ALCHEMY_DEV } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Output from "alchemy/Output";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { accessResources } from "./alchemy/Access.ts";
import { stringOr } from "./alchemy/config.ts";
import { Database } from "./alchemy/Db.ts";

/**
 * The platform provisioning its own infrastructure (Phase 6, P6-01/02): the
 * control-plane Worker, the dashboard (a client-rendered SvelteKit SPA), their
 * shared D1 database, and — on deploy only — the Cloudflare Access perimeter.
 * This is where the platform is deployed for the first time, already behind
 * Access, never before (see docs/adr/0009 + docs/ROADMAP.md sequencing).
 *
 * `alchemy dev` runs the whole stack against local simulators (workerd + a
 * local D1) — it needs a Cloudflare identity (`alchemy profile edit --add
 * Cloudflare`, one time) but touches nothing remote. The Zero Trust / Access
 * resources are `ALCHEMY_DEV`-guarded because they have no local simulator —
 * the control-plane's JWT middleware already runs ungated when
 * `CF_ACCESS_AUD` is absent.
 *
 * There is no Cloudflare API token anywhere in this stack or the deployed
 * Worker (ADR-0009 update): Alchemy authenticates as itself
 * via its own Cloudflare profile's OAuth credentials, scoped and cached to
 * the deploying machine (`~/.alchemy`) — never a Worker binding, never
 * minted by hand in the Cloudflare dashboard.
 *
 * State: local filesystem for `alchemy dev` / manual runs; the Cloudflare-backed
 * remote store in CI. The real `alchemy deploy`, the Zero Trust org + Google IdP,
 * and the end-to-end check (P6-06) are driven by scripts/phase-6-deploy.sh.
 */
export default Alchemy.Stack(
  "cloudflare-idp",
  {
    providers: Layer.mergeAll(Cloudflare.providers()),
    state: process.env.CI ? Cloudflare.state() : Alchemy.localState(),
  },
  Effect.gen(function* () {
    const dev = yield* ALCHEMY_DEV;
    const database = yield* Database;
    const accessTeamDomain = yield* stringOr("CF_ACCESS_TEAM_DOMAIN", "dev-team");
    const dashboardOrigin = yield* stringOr("DASHBOARD_ORIGIN", "");

    // Zero Trust resources have no local simulator, so they're deploy-only.
    // The explicit `Access.Application` (rather than the inline `access:
    // { policies }` form) is what lets its AUD tag flow back into the Worker
    // for server-side JWT verification (P6-03).
    //
    // Both `allowCi` (the shared GitHub Actions service token) and `allowTeam`
    // (the founder's Google login, already declared for the dashboard) sit on
    // this one Application — Access only answers "can this reach the Worker at
    // all," not "which kind of caller is this for which route." That split now
    // happens server-side, off the verified JWT's `email` claim (present only
    // for identity logins): see `middleware/requireIdentity.ts` and ADR-0005's
    // 2026-09 update.
    const buildAccess = Effect.gen(function* () {
      const { serviceToken, allowTeam, allowCi } = yield* accessResources;
      const googleIdpId = yield* stringOr("CF_GOOGLE_IDP_ID", "dev-google-idp");
      const application = yield* Cloudflare.Access.Application("control-plane-access", {
        type: "self_hosted",
        name: "cloudflare-idp control-plane API",
        policies: [allowCi, allowTeam],
        allowedIdps: [googleIdpId],
      });
      return { serviceToken, allowTeam, application, googleIdpId };
    });
    const access = dev ? null : yield* buildAccess;

    const controlPlane = yield* Cloudflare.Worker("control-plane", {
      name: "production-control-plane",
      main: "./apps/control-plane/src/index.ts",
      compatibility: { flags: ["nodejs_compat"], date: "2026-09-05" },
      // Workers Logs: the control plane's structured `console.log`/`console.error`
      // lines (helpers/logger.ts) plus one invocation log per request, indexed
      // and queryable in the dashboard. On by default in Alchemy; set explicitly
      // so the sampling rate is visible here. Keep at 1 — the control plane is
      // low-traffic (one GitHub Actions run per deploy) and every request matters.
      observability: {
        enabled: true,
        headSamplingRate: 1,
        logs: { enabled: true, invocationLogs: true },
      },
      // Pin the local port so the dashboard's `$env/dynamic/public` fallback in
      // `apps/dashboard/src/lib/api/client.ts` stays correct for a standalone
      // `vite dev`; under `alchemy dev` the real URL is wired through instead.
      dev: { port: 9003 },
      ...(access ? { access: access.application } : {}),
      env: {
        DB: database,
        CF_ACCESS_TEAM_DOMAIN: accessTeamDomain,
        // Not derived from `dashboard.url` below — that would be a circular
        // dependency (dashboard's own env already depends on controlPlane.url).
        // A manually-captured value instead, same as CF_ACCESS_TEAM_DOMAIN /
        // CF_GOOGLE_IDP_ID. Empty locally: the CORS middleware treats that as
        // "no restriction," matching every other ungated-in-dev behavior here.
        DASHBOARD_ORIGIN: dashboardOrigin,
        ...(access ? { CF_ACCESS_AUD: access.application.aud } : {}),
      },
    });

    const dashboard = yield* Cloudflare.Website.SvelteKit("dashboard", {
      name: "production-dashboard",
      rootDir: "./apps/dashboard",
      // Client-rendered SPA (`ssr = false`): deep links fall back to index.html
      // and the client router takes over.
      assets: { notFoundHandling: "single-page-application" },
      ...(access
        ? {
            access: {
              policies: [access.allowTeam],
              allowedIdps: [access.googleIdpId],
              autoRedirectToIdentity: true,
            },
          }
        : {}),
      env: {
        PUBLIC_CONTROL_PLANE_URL: Output.interpolate`${controlPlane.url}`,
      },
    });

    return {
      controlPlaneUrl: controlPlane.url,
      dashboardUrl: dashboard.url,
      // Paste these into the deploy wizard when it asks (deploy only).
      ...(access
        ? { accessAud: access.application.aud, serviceTokenClientId: access.serviceToken.clientId }
        : {}),
    };
  }),
);
