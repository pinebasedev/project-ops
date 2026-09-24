import * as Alchemy from "alchemy";
import { ALCHEMY_DEV } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { accessResources } from "./alchemy/Access.ts";
import { stringOr } from "./alchemy/config.ts";
import { Database } from "./alchemy/Db.ts";

/**
 * The platform provisioning its own infrastructure (Phase 6, P6-01/02): one
 * SvelteKit Worker (the dashboard UI plus the control-plane API, mounted
 * same-origin at `/v1/*` — see docs/adr/0009's merge update), its D1
 * database, and — on deploy only — the Cloudflare Access perimeter. This is
 * where the platform is deployed for the first time, already behind Access,
 * never before (see docs/adr/0009 + docs/ROADMAP.md sequencing).
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
  "project-ops",
  {
    providers: Layer.mergeAll(Cloudflare.providers()),
    state: process.env.CI ? Cloudflare.state() : Alchemy.localState(),
  },
  Effect.gen(function* () {
    const dev = yield* ALCHEMY_DEV;
    const database = yield* Database;
    const accessTeamDomain = yield* stringOr("CF_ACCESS_TEAM_DOMAIN", "dev-team");

    // Zero Trust resources have no local simulator, so they're deploy-only.
    // The explicit `Access.Application` (rather than the inline `access:
    // { policies }` form) is what lets its AUD tag flow back into the Worker
    // for server-side JWT verification (P6-03).
    //
    // Both `allowCi` (the shared GitHub Actions service token) and `allowTeam`
    // (the operator's Google login) sit on this one Application, gating the
    // whole merged Worker — Access only answers "can this reach the Worker at
    // all," not "which kind of caller is this for which route." That split
    // happens server-side, off the verified JWT's `email` claim (present only
    // for identity logins): see `middleware/requireIdentity.ts` and ADR-0005's
    // 2026-09 merge update. (Consequence, accepted there: a CI service token
    // can now also load the dashboard's pages — its `/v1` reads still 401 via
    // `requireIdentityMiddleware`, same as before the merge.)
    const buildAccess = Effect.gen(function* () {
      const { serviceToken, allowTeam, allowCi } = yield* accessResources;
      // Required on deploy — a placeholder IdP id would stand up an
      // Application nobody can log in to.
      const googleIdpId = yield* Config.String("CF_GOOGLE_IDP_ID");
      const application = yield* Cloudflare.Access.Application("app-access", {
        type: "self_hosted",
        name: "project-ops platform",
        policies: [allowCi, allowTeam],
        allowedIdps: [googleIdpId],
        autoRedirectToIdentity: true,
      });
      return { serviceToken, application };
    });
    const access = dev ? null : yield* buildAccess;

    // One SvelteKit Worker: the dashboard UI (client-rendered, `ssr = false`)
    // plus the control-plane API, mounted same-origin at `/v1/*` via
    // `apps/dashboard/src/routes/v1/[...rest]/+server.ts` (ADR-0009's merge
    // update). `apps/control-plane` is now a workspace-internal library, not
    // its own deploy target.
    const app = yield* Cloudflare.Website.SvelteKit("dashboard", {
      name: "production-dashboard",
      rootDir: "./apps/dashboard",
      compatibility: { flags: ["nodejs_compat"], date: "2026-09-05" },
      // Workers Logs: the control-plane routes' structured `console.log`/
      // `console.error` lines (helpers/logger.ts) plus one invocation log per
      // request, indexed and queryable in the dashboard. On by default in
      // Alchemy; set explicitly so the sampling rate is visible here. Keep at
      // 1 — this is low-traffic (one GitHub Actions run per deploy, plus the
      // operator's own dashboard use) and every request matters.
      observability: {
        enabled: true,
        headSamplingRate: 1,
        logs: { enabled: true, invocationLogs: true },
      },
      // Deep links fall back to index.html and the client router takes over
      // for dashboard pages; `/v1/*` requests hit the Worker's own routing
      // (the `+server.ts` catch-all) before ever reaching this fallback.
      assets: { notFoundHandling: "single-page-application" },
      ...(access ? { access: access.application } : {}),
      env: {
        DB: database,
        CF_ACCESS_TEAM_DOMAIN: accessTeamDomain,
        ...(access ? { CF_ACCESS_AUD: access.application.aud } : {}),
      },
    });

    return {
      dashboardUrl: app.url,
      // Paste these into the deploy wizard when it asks (deploy only).
      ...(access
        ? { accessAud: access.application.aud, serviceTokenClientId: access.serviceToken.clientId }
        : {}),
    };
  }),
);
