# The platform provisions itself with one Alchemy stack, deploy-only

Status: accepted

The control-plane API, the dashboard, their shared D1 database, the Cloudflare Access perimeter ([ADR-0005](./0005-cloudflare-access-in-front-of-dashboard-and-api.md)), and the control-plane's Secrets Store entry are all declared in a single Alchemy stack at the repo root (`alchemy.run.ts` + `alchemy/`), one stage: `prod`. This is where the platform is deployed for the first time — already behind Access, never before (see `docs/ROADMAP.md`, "Sequencing assumptions"). It extends [ADR-0001](./0001-alchemy-provisioning-driven-by-github-actions.md), which governs how *managed projects* are provisioned; this ADR covers the platform provisioning itself.

- **One stack, not one-per-component.** The dashboard's typed-client base URL is the control-plane Worker's URL, the control-plane's `CF_ACCESS_AUD` is the Access application's audience tag, and the Access application spans both Workers — the resources are too coupled to split, and a single `alchemy deploy` standing up the whole platform (Access included) is the property [ADR-0005](./0005-cloudflare-access-in-front-of-dashboard-and-api.md) asks for.
- **Deploy-only. Local development stays on `@cloudflare/vite-plugin` / `vite dev`.** Alchemy plans the Access resources against the live Zero Trust API even under `alchemy dev`, so `alchemy dev` cannot run without a connected account — it is not a local-development tool here. The control-plane keeps its `wrangler.jsonc`; Alchemy's `Worker({ main })` bundles the same entrypoint independently for deploy.
- **`CLOUDFLARE_API_TOKEN` moves to Secrets Store** (P6-04); everything else the Worker reads (`CLOUDFLARE_ACCOUNT_ID`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`) is a plain binding — the AUD tag and team domain aren't secret, and keeping them as strings avoids an async `.get()` on the request path.
- **The dashboard deploys via `Cloudflare.Website.SvelteKit`**, which replaces `@sveltejs/adapter-static` with Alchemy's in-memory Cloudflare adapter at build time. The local `adapter-static` config is untouched.
- **`/v1/health` is exempt from the server-side Access check** (P6-03) so uptime probes don't need a service token; every other route is gated.

## Consequences

`alchemy deploy`, the Zero Trust org, the Google IdP, and the end-to-end verification (P6-06) can't be exercised in CI or locally without the account — they're driven by `scripts/phase-6-deploy.sh` and remain unproven until the founder runs it. The `Website.SvelteKit` adapter swap and the Secrets Store runtime binding shape are first validated on that deploy.

Adding Alchemy pulls `effect@4-rc`, `rolldown`, and a large dependency tree into a repo that was otherwise lean — accepted as the cost of self-provisioning.
