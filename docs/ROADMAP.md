# Roadmap

Full implementation sequence, in build order. Each ticket is sized to be roughly one coherent commit (or a small handful) per [`CONTRIBUTING.md`](../CONTRIBUTING.md). References back to [`ARCHITECTURE.md`](../ARCHITECTURE.md), [`CONTEXT.md`](../CONTEXT.md), and the ADRs instead of restating them.

**Sequencing assumptions, made explicit:**
- **The control-plane API and dashboard are never deployed until Phase 6.** The platform provisions its own infra there (P6-01) and it goes up already behind Cloudflare Access (P6-02) — there is no window where a public, unauthenticated control-plane exists on the internet. Phases 1–5 develop and test them locally: the control-plane via `@cloudflare/vite-plugin` and its unit suite, the dashboard via `vite dev` against a locally-run control-plane.
- Cloudflare Access and self-provisioning-via-Alchemy (ADR-0005) are deliberately last, not woven through every earlier phase — building the functional loop first, hardening once it works, avoids re-testing everything through an auth layer while the design is still moving.
- **Consequence**: the CI → control-plane callback (P1-08) and its later extensions (P3-04, P4-02) are written and unit-tested in their own phases but only exercised end to end by the final check (P6-06), since GitHub Actions can't reach a local control-plane. The same applies to the demo-project CI and live Integration Test suite (P3-02, P3-03) and the remaining Alchemy stages (P3-01, P4-01): coded in-phase where practical, but the real deploys and live runs happen after Phase 6, once the platform they report to is deployed and Access-gated. The managed project's own Alchemy provisioning (P1-06 onward) still involves real Cloudflare deploys throughout — that's inherent to proving provisioning works, and is unaffected.
- Managed-project tickets (marked below) happen in `/Users/stefan/Code/Pinebase/demo-project` — a copy of the Svelteflare boilerplate used as the platform's first managed Project — not this repo.

---

## Phase 0 — Foundations

- [x] **P0-01** `chore(tooling)` Initialize pnpm workspace: `package.json`, `pnpm-workspace.yaml`, `apps/control-plane`, `apps/dashboard`. No shared `packages/ui` (ADR: inline UI decision, see `ARCHITECTURE.md`).
- [x] **P0-02** `chore(tooling)` Configure the Vite+ toolchain: Oxlint + Oxfmt at the workspace root, applied to both apps.
- [x] **P0-03** `chore(tooling)` Wire up commitlint + Husky using the config already drafted in `CONTRIBUTING.md` (`commit-msg` hook running `commitlint --edit $1`).
- [x] **P0-04** `feat(control-plane)` Scaffold the control-plane app: Hono app-factory (`createApp(overrides)`), `routes/` `middleware/` `helpers/` `db/` folders, `requestId` + `secureHeaders` middleware, centralized `onError`/`notFound` handlers, everything mounted under `/v1`.
- [x] **P0-05** `feat(dashboard)` Scaffold the dashboard app: SvelteKit via `@cloudflare/vite-plugin`, Tailwind + shadcn-svelte installed (`pnpm dlx skills add huntabyte/shadcn-svelte` + relevant Svelte skills), empty shell page.

## Phase 1 — PR ephemeral environments (managed project, local-first)

**Done when:** the demo-project Alchemy stack provisions and destroys an isolated PR environment for real (`alchemy deploy`/`destroy --stage pr-{n}`), the preview URL is posted as a PR comment, and a locally-run control plane records the Deployment when the callback points at it. The deployed, CI-driven run of this loop is the final check in Phase 6 (P6-06).

- [x] **P1-01** `feat(db)` Drizzle schema: `Project`, `Environment` (`kind` enum includes all three values now, even though only `ephemeral` is used yet — avoids a later migration), `Deployment` (`status`, `commit_sha`, `pr_number`, `preview_url`, timestamps). Migrations via `drizzle-kit`.
- [x] **P1-02** `feat(api)` Per-project bearer token: mint-token flow, hashed storage on the `Project` row (never the raw value — see the token-storage discussion in `ARCHITECTURE.md`), Bearer-auth middleware guarding write routes.
- [x] **P1-03** `feat(control-plane)` Project registration — a route or script to create a `Project` row and mint its token. (Dashboard UI for this can wait; a raw POST or CLI script is enough for now.)
- [x] **P1-04** `feat(api)` Deployment callback routes: `POST` to mark a Deployment `in_progress`, and to mark it `done`/`failed` with commit SHA, PR number, preview URL.
- [x] **P1-05** `feat(api)` Query routes: list Environments (filterable by `kind`), get an Environment, get a Deployment.
- [x] **P1-06** `feat(alchemy)` *(demo-project repo)* `alchemy.run.ts` provisioning stage `pr-{number}`, remote state via `Cloudflare.state()`, a `GitHub.Comment` resource posting the preview URL. Prove it manually first — `alchemy deploy --stage pr-test`, then `destroy` — before wiring to Actions. *(Code written + typecheck + `alchemy dev` parse (all resources/bindings resolve); the real `alchemy deploy --stage pr-test` proof is still pending. Alchemy fully owns the api's build/dev/deploy — no wrangler.jsonc / vite-plugin. Scope: api Worker + D1 + R2 + rate limiters + secrets. `EMAIL` skipped (needs a zone); web SvelteKit resource scaffolded, not wired.)*
- [x] **P1-07** `feat(ci)` *(demo-project repo)* GitHub Actions: the two-job pattern from Alchemy's CI guide (deploy job on `pull_request`, cleanup job on `pull_request: closed` with the prod-destroy safety guard). New commits redeploy the same stage. *(`.github/workflows/preview.yml`.)*
- [x] **P1-08** `feat(integration)` *(demo-project repo)* Wire the callback into the workflow: after `alchemy deploy`/`destroy`, `POST` status to the control-plane API using the per-project token from a repo secret. *(Deploy callback done — register/complete/failed. No destroy callback: the API has no "destroyed" Deployment status. The CI → control-plane leg is verified end to end in P6-06, once the control plane is deployed.)*

> **Alchemy note (2026-09):** current Alchemy is `2.0.0-beta.76`, a fully Effect-based framework — not the thin "point at your build output" provisioner ADR-0001 was written against. It works (the api deploys via Alchemy's async-handler shape, no rewrite), but the dep tree is heavy (`effect@4-rc`, `drizzle@1-rc`, `rolldown`) and the SvelteKit path needs app-level adapter changes. Worth revisiting ADR-0001 before Phase 6's self-provisioning.

## Phase 2 — Dashboard: view active environments

Also added here (not separately ticketed): `GET /v1/projects` and an embedded
`latestDeployment` on the environment query routes — the list/detail views need
per-environment deployment state, which lives on the `Deployment` row.

- [x] **P2-01** `feat(dashboard)` Typed RPC client: import the control-plane's Hono `AppType`, wrap in `hc<AppType>()`.
- [x] **P2-02** `feat(dashboard)` Environments list view: active ephemeral Environments for a Project (PR number, preview URL, status, commit SHA). Answers "which PR environments are currently active?"
- [x] **P2-03** `feat(dashboard)` Deployment detail view: an Environment's latest Deployment (status, commit).

## Phase 3 — Staging + Integration Tests

The control-plane half of this phase (P3-04, P3-05) lands here. The demo-project
half — the Alchemy `staging` stage, the CI that drives it, and the live
Integration Test suite (P3-01 remainder, P3-02, P3-03) — is **deferred to run for
real only after Phase 6**, alongside P6-06: the same reasoning as the P1-08
callback leg (see sequencing assumptions), plus the platform it reports to must
be deployed and behind Access before an external CI run can exercise it.

- [ ] **P3-01** `feat(db)` `Environment.kind` gains `staging` in practice; extend demo-project's Alchemy stack with stage `staging`. *(Control-plane side needs nothing — `kind` already carries `staging` and the query/dashboard paths now exercise it. Remaining: the demo-project Alchemy `staging` stage, a real deploy — deferred to Phase 6.)*
- [ ] **P3-02** `feat(ci)` *(demo-project repo)* Merging a PR into `staging` triggers an Alchemy deploy of stage `staging` and destroys the merged PR's `pr-{number}` stage. *(Deferred to Phase 6 — needs the deployed, Access-gated control plane.)*
- [ ] **P3-03** `test(integration)` *(demo-project repo)* The actual Integration Test suite — runs once, live, against the deployed staging URL (ADR-0006). *(Deferred to Phase 6, with P6-06.)*
- [x] **P3-04** `feat(api)` Extend the callback payload with the aggregate integration-test result (pass/fail counts) + Actions run URL — no per-test detail (ADR-0007). *(New route `POST /v1/deployments/:id/integration-results` — separate from `/complete` since the live suite runs after the deploy is already `done`. Adds `integration_tests_passed` / `_failed` / `_run_url` to the `deployments` table.)*
- [x] **P3-05** `feat(dashboard)` Staging status view: current Deployment + Integration Test result, prominent — this is what stops someone promoting a broken staging (ADR-0006's consequence, since promotion itself is ungated). *(`/projects/:id/staging`, linked from the project page. Integration Test panel turns red on failure.)*

## Phase 4 — Promotion + Production

The dashboard half of this phase (P4-03, P4-04) lands here. The demo-project
half — `Environment.kind` gaining `production` in practice, the Alchemy `prod`
stage with its destroy guard, and the CI that deploys it on `staging` → `main`
(P4-01 remainder, P4-02) — is **deferred to run for real only after Phase 6**,
alongside P6-06: the same reasoning as the P3-01/P3-02 deferral (see sequencing
assumptions), plus the platform it reports to must be deployed and behind Access
before an external CI run can exercise it.

- [ ] **P4-01** `feat(db)` `Environment.kind` gains `production`; extend the Alchemy stack with stage `prod`, including the destroy safety guard. *(Control-plane side needs nothing — `kind` already carries `production` and the query/dashboard paths now exercise it. Remaining: the demo-project Alchemy `prod` stage + destroy guard, a real deploy — deferred to Phase 6.)*
- [ ] **P4-02** `feat(ci)` *(demo-project repo)* Merging `staging` → `main` triggers an Alchemy deploy of stage `prod`; callback reports the production Deployment. *(Deferred to Phase 6 — needs the deployed, Access-gated control plane. The production Deployment goes through the same create/`complete` callback routes as staging; no new control-plane route needed.)*
- [x] **P4-03** `feat(dashboard)` Production status view: "what commit is currently running in production?" *(`/projects/:id/production`, linked from the project page. Read-only — promotion is a git merge, not a dashboard action (ADR-0002). No Integration Test panel; those run only against staging (ADR-0006).)*
- [x] **P4-04** `feat(dashboard)` Deployment diff link-out: given two Deployments, link to GitHub's compare view using their commit SHAs (ADR-0007). *(Adds a nullable `projects.github_repo` slug (`feat(api)`) — the data the compare URL needs. The link lives on the staging view as "compare with production — what promotion would ship", `github.com/{owner}/{repo}/compare/{prod}...{staging}`. `githubCompareUrl` hides it when the slug or a commit is missing, or the two commits match.)*

## Phase 5 — Observability

- [x] **P5-01** `feat(observability)` Control-plane's own Cloudflare API token for querying the Workers Observability Telemetry API — `.dev.vars` locally for now (Secrets Store lands in Phase 6). *(`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` bindings + `.dev.vars.example`. `observabilityFromEnv` builds the client, or null when either is unset — the query route then 503s "not configured". Needs the "Workers Observability Write" token permission.)*
- [x] **P5-02** `feat(observability)` Query route: given an Environment, call Cloudflare's Telemetry API filtered by Worker + time range (ADR-0004). *(`GET /v1/environments/:id/errors` — `POST …/telemetry/query` filtered by `$metadata.service` = `<project>-<stage>` (convention, see ADR-0004 notes), `$metadata.level=error`, window from the latest Deployment's `created_at`. Unauthenticated like the sibling read routes. Nothing stored. Upstream failure → 502; no deployment yet → `{ since: null, errors: [] }`. The `ObservabilityClient` seam is injected in tests; the real end-to-end run waits for Phase 6.)*
- [x] **P5-03** `feat(dashboard)` Recent-errors view: errors for an Environment since its latest Deployment. Answers "what errors appeared after the latest production deployment?" *(Section on the Environment detail page, streamed (not awaited) from the loader so a slow/unavailable Telemetry query never blocks the page. Degrades to a notice on "not configured" / "unavailable" rather than erroring.)*

## Phase 6 — Harden: Access + self-provisioning + first real deploy

This is where the platform is deployed for the first time — already behind Access, never before.

- [ ] **P6-01** `feat(alchemy)` `alchemy.run.ts` for the platform's *own* infra: control-plane + dashboard Workers, D1 — the platform starts provisioning itself. Includes applying the control-plane's D1 migrations on deploy and the dashboard's typed-client base URL wiring.
- [ ] **P6-02** `feat(infra)` Cloudflare Access resources in that same stack: `Access.Application` + `Access.Policy` (interactive IdP login) for the dashboard; `Access.ServiceToken` for GitHub Actions callers of the control-plane API (ADR-0005).
- [ ] **P6-03** `feat(api)` Access JWT verification middleware in the control-plane Worker — defense in depth, independent of the edge gate (ADR-0005).
- [ ] **P6-04** `feat(infra)` Migrate the control-plane's own fixed secrets to Cloudflare Secrets Store for deployed environments.
- [ ] **P6-05** `feat(ci)` *(demo-project repo)* Add `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET` secrets, sent alongside the existing per-project bearer token on every callback.
- [ ] **P6-06** `feat(infra)` End-to-end verification. With the control-plane + dashboard deployed and Access-gated (P6-01–04) and demo-project sending Access credentials (P6-05): open a real PR on demo-project and confirm the whole chain through Access — provision → control-plane records the Deployment → preview comment → merge into `staging` → integration tests → promote to `main` → prod deploy → dashboard reflects every step. Was the old "P1-09"; deferred to here so the platform's first deployment is never unauthenticated.
