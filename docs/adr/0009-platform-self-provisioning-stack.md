# The platform provisions itself with one Alchemy stack

Status: accepted

The control-plane API, the dashboard, their shared D1 database, the Cloudflare Access perimeter ([ADR-0005](./0005-cloudflare-access-in-front-of-dashboard-and-api.md)), and the control-plane's Secrets Store entry are all declared in a single Alchemy stack at the repo root (`alchemy.run.ts` + `alchemy/`), one stage: `prod`. Alchemy owns build, dev, and deploy for both apps — the control-plane's `wrangler.jsonc` and `@cloudflare/vite-plugin` are gone. This is where the platform is deployed for the first time, already behind Access, never before (see `docs/ROADMAP.md`, "Sequencing assumptions"). It extends [ADR-0001](./0001-alchemy-provisioning-driven-by-github-actions.md), which governs how *managed projects* are provisioned; this ADR covers the platform provisioning itself.

- **One stack, not one-per-component.** The dashboard's typed-client base URL is the control-plane Worker's URL, the control-plane's `CF_ACCESS_AUD` is the Access application's audience tag, and the Access application spans both Workers — the resources are too coupled to split, and a single `alchemy deploy` standing up the whole platform (Access included) is the property [ADR-0005](./0005-cloudflare-access-in-front-of-dashboard-and-api.md) asks for.
- **`alchemy dev` is the local workflow.** `pnpm dev` runs the whole stack against local simulators (workerd + a local SQLite D1; SvelteKit's own vite dev server for the dashboard). It needs a Cloudflare identity — `alchemy profile edit --add Cloudflare` once, cached to `~/.alchemy`, the same one-time step as `wrangler login` — but touches nothing remote; real changes happen only on `alchemy deploy`.
- **Two resources are `ALCHEMY_DEV`-guarded** because they have no local simulator and their providers reach the real account even in local mode:
  - the **Zero Trust / Access** resources (application, policies, service token) — so `alchemy dev` needs no Access org. The control-plane's JWT middleware already runs ungated when `CF_ACCESS_AUD` is absent (P6-03), which is exactly the local state.
  - the **Secrets Store** — locally `CLOUDFLARE_API_TOKEN` is a plain `secret_text` binding instead of a store secret. `resolveSecret` in the Worker flattens both shapes, so the code path is identical.
- **`CLOUDFLARE_API_TOKEN` moves to Secrets Store on deploy** (P6-04); everything else the Worker reads (`CLOUDFLARE_ACCOUNT_ID`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`) is a plain binding — the AUD tag and team domain aren't secret, and keeping them as strings avoids an async `.get()` on the request path. **(2026-09 update: reversed — see below.)**
- **The dashboard deploys via `Cloudflare.Website.SvelteKit`**, which replaces `@sveltejs/adapter-static` with Alchemy's in-memory Cloudflare adapter at build time. `ssr = false` keeps it a client-rendered SPA (`assets.notFoundHandling: "single-page-application"` for deep links). The standalone `adapter-static` config is left in place for `svelte-check` / a plain `vite build`.
- **The dashboard's control-plane URL** is `controlPlane.url`, which under `alchemy dev` resolves to the local dev server — so `pnpm dev` wires it through automatically. The `client.ts` `http://localhost:9003` fallback only matters when running `vite dev` on just the dashboard; the control-plane Worker pins `dev: { port: 9003 }` so that stays correct.
- **`/v1/health` is exempt from the *server-side* Access check** (P6-03), so the JWT middleware can never be what makes a health check fail. The *edge* Access application still covers the whole control-plane hostname — an external uptime probe needs the service-token headers (or Cloudflare's own health checks) to reach it. A path-scoped edge bypass for `/v1/health` was considered and left out: not worth a second Access application.

## Consequences

Local dev now needs `alchemy profile edit --add Cloudflare` once — a fresh clone can't `pnpm dev` before that. Accepted: it's the same shape as `wrangler login`, and it buys one build/dev/deploy path instead of two.

`alchemy deploy`, the Zero Trust org, the Google IdP, and the end-to-end verification (P6-06) can't be exercised in CI without the account — they're driven by `scripts/phase-6-deploy.sh` and remain unproven until the founder runs it. First validated on that deploy: the `Website.SvelteKit` adapter swap; the Secrets Store runtime binding shape; and whether `Website.SvelteKit`'s `env` reaches the dashboard's `$env/dynamic/public` read of `PUBLIC_CONTROL_PLANE_URL` at *build* time (an assets-only SPA inlines it) — if it doesn't, the deployed bundle keeps the `localhost:9003` fallback and the dashboard can't reach the API.

Adding Alchemy pulls `effect@4-rc`, `rolldown`, and a large dependency tree into a repo that was otherwise lean — accepted as the cost of self-provisioning.

## Update (2026-09, no platform Cloudflare API token)

`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` and the Secrets Store entry
(`alchemy/Secrets.ts`, P6-04) are removed, along with the recent-errors feature
that was their only runtime consumer (queried Cloudflare's Workers
Observability Telemetry API — not worth the credential surface for a
single-operator platform that already has the Cloudflare dashboard). The
control-plane Worker now takes no Cloudflare-credential binding at all — its
only bindings are `DB` and the two plain Access strings
(`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`).

Alchemy's own deploy-time authentication (needed to create the Worker, D1
database, and Access resources) no longer goes through a manually-minted API
token either. `pnpm alchemy profile edit --add Cloudflare` → OAuth, with the
default scopes customized to add `access:write` (Access isn't in Alchemy's
default OAuth scope set; D1/Workers/Secrets-Store-adjacent scopes already are)
— the resulting credentials are cached to `~/.alchemy/credentials` on the
deploying machine, refresh automatically, and are never printed, pasted, or
wired into a Worker.
This replaces `scripts/phase-6-deploy.sh`'s old "create a Custom Token in the
Cloudflare dashboard, paste it here" stage entirely: the claim that "login
alone isn't enough for the Access + Secrets Store providers" (the reason that
stage existed) turned out to be wrong for Access — Alchemy's OAuth flow
supports arbitrary scope customization, it just isn't in the default set — and
moot for Secrets Store now that nothing lives there.

Net effect: the platform's Cloudflare credential surface is now exactly one
thing — an OAuth session, local to whichever machine connected Alchemy's
Cloudflare profile, with exactly the scopes Alchemy's own resources need. No account-wide API token
exists anywhere in this stack, deployed or otherwise.
