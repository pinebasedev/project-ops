# Roadmap

Full implementation sequence, in build order. Each ticket is sized to be roughly one coherent commit (or a small handful) per [`CONTRIBUTING.md`](../CONTRIBUTING.md). References back to [`ARCHITECTURE.md`](../ARCHITECTURE.md), [`CONTEXT.md`](../CONTEXT.md), and the ADRs instead of restating them.

**Sequencing assumptions, made explicit:**
- Phase 1 proves Alchemy PR-stage provisioning and the control-plane API's logic independently (mostly local, via `@cloudflare/vite-plugin` and manual `alchemy deploy`/`destroy`) before connecting them for real — a bare `wrangler deploy` of the control-plane API only happens at the very end of Phase 1, purely so GitHub Actions has something reachable to call.
- Cloudflare Access and self-provisioning-via-Alchemy for the platform's own infra (ADR-0005) are deliberately last (Phase 6), not woven through every earlier phase — building the functional loop first, hardening once it works, avoids re-testing everything through an auth layer while the design is still moving.
- **Known trade-off from that ordering**: between Phase 1's bare deploy and Phase 6, the control-plane API and dashboard are reachable without Access — writes still require the per-project bearer token (unaffected by this ordering), but dashboard reads are not yet gated. Accepted: the project isn't actually put into real use until every phase, including Phase 6, is implemented — the intermediate deploys exist only to close each phase's loop during development, not as a running service anyone relies on.
- Svelteflare-repo tickets (marked below) happen in `/Users/stefan/Code/Pinebase/svelteflare`, not this repo.

---

## Phase 0 — Foundations

- [x] **P0-01** `chore(tooling)` Initialize pnpm workspace: `package.json`, `pnpm-workspace.yaml`, `apps/control-plane`, `apps/dashboard`. No shared `packages/ui` (ADR: inline UI decision, see `ARCHITECTURE.md`).
- [x] **P0-02** `chore(tooling)` Configure the Vite+ toolchain: Oxlint + Oxfmt at the workspace root, applied to both apps.
- [x] **P0-03** `chore(tooling)` Wire up commitlint + Husky using the config already drafted in `CONTRIBUTING.md` (`commit-msg` hook running `commitlint --edit $1`).
- [x] **P0-04** `feat(control-plane)` Scaffold the control-plane app: Hono app-factory (`createApp(overrides)`), `routes/` `middleware/` `helpers/` `db/` folders, `requestId` + `secureHeaders` middleware, centralized `onError`/`notFound` handlers, everything mounted under `/v1`.
- [x] **P0-05** `feat(dashboard)` Scaffold the dashboard app: SvelteKit via `@cloudflare/vite-plugin`, Tailwind + shadcn-svelte installed (`pnpm dlx skills add huntabyte/shadcn-svelte` + relevant Svelte skills), empty shell page.

## Phase 1 — PR ephemeral environments (Svelteflare only, local-first)

**Done when:** opening a real PR against Svelteflare provisions an isolated environment, the control plane records it, the preview URL is posted as a PR comment, and merging destroys it — all observable via direct API calls (dashboard comes in Phase 2).

- [x] **P1-01** `feat(db)` Drizzle schema: `Project`, `Environment` (`kind` enum includes all three values now, even though only `ephemeral` is used yet — avoids a later migration), `Deployment` (`status`, `commit_sha`, `pr_number`, `preview_url`, timestamps). Migrations via `drizzle-kit`.
- [x] **P1-02** `feat(api)` Per-project bearer token: mint-token flow, hashed storage on the `Project` row (never the raw value — see the token-storage discussion in `ARCHITECTURE.md`), Bearer-auth middleware guarding write routes.
- [x] **P1-03** `feat(control-plane)` Project registration — a route or script to create a `Project` row and mint its token. (Dashboard UI for this can wait; a raw POST or CLI script is enough for now.)
- [x] **P1-04** `feat(api)` Deployment callback routes: `POST` to mark a Deployment `in_progress`, and to mark it `done`/`failed` with commit SHA, PR number, preview URL.
- [x] **P1-05** `feat(api)` Query routes: list Environments (filterable by `kind`), get an Environment, get a Deployment.
- [ ] **P1-06** `feat(alchemy)` *(Svelteflare repo)* `alchemy.run.ts` provisioning stage `pr-{number}`, remote state via `Cloudflare.state()`, a `GitHub.Comment` resource posting the preview URL. Prove it manually first — `alchemy deploy --stage pr-test`, then `destroy` — before wiring to Actions.
- [ ] **P1-07** `feat(ci)` *(Svelteflare repo)* GitHub Actions: the two-job pattern from Alchemy's CI guide (deploy job on `pull_request`, cleanup job on `pull_request: closed` with the prod-destroy safety guard). New commits redeploy the same stage.
- [ ] **P1-08** `feat(integration)` *(Svelteflare repo)* Wire the callback into the workflow: after `alchemy deploy`/`destroy`, `POST` status to the control-plane API using the per-project token from a repo secret.
- [ ] **P1-09** `feat(infra)` Bare `wrangler deploy` of the control-plane API (no Access yet) — just enough to be reachable. Close the loop for real against Svelteflare: open a PR, confirm provisioning + recording + preview comment, merge, confirm destruction.

## Phase 2 — Dashboard: view active environments

- [ ] **P2-01** `feat(dashboard)` Typed RPC client: import the control-plane's Hono `AppType`, wrap in `hc<AppType>()`.
- [ ] **P2-02** `feat(dashboard)` Environments list view: active ephemeral Environments for a Project (PR number, preview URL, status, commit SHA). Answers "which PR environments are currently active?"
- [ ] **P2-03** `feat(dashboard)` Deployment detail view: an Environment's latest Deployment (status, commit).

## Phase 3 — Staging + Integration Tests

- [ ] **P3-01** `feat(db)` `Environment.kind` gains `staging` in practice; extend Svelteflare's Alchemy stack with stage `staging`.
- [ ] **P3-02** `feat(ci)` *(Svelteflare repo)* Merging a PR into `staging` triggers an Alchemy deploy of stage `staging` and destroys the merged PR's `pr-{number}` stage.
- [ ] **P3-03** `test(integration)` *(Svelteflare repo)* The actual Integration Test suite — runs once, live, against the deployed staging URL (ADR-0006).
- [ ] **P3-04** `feat(api)` Extend the callback payload with the aggregate integration-test result (pass/fail counts) + Actions run URL — no per-test detail (ADR-0007).
- [ ] **P3-05** `feat(dashboard)` Staging status view: current Deployment + Integration Test result, prominent — this is what stops someone promoting a broken staging (ADR-0006's consequence, since promotion itself is ungated).

## Phase 4 — Promotion + Production

- [ ] **P4-01** `feat(db)` `Environment.kind` gains `production`; extend the Alchemy stack with stage `prod`, including the destroy safety guard.
- [ ] **P4-02** `feat(ci)` *(Svelteflare repo)* Merging `staging` → `main` triggers an Alchemy deploy of stage `prod`; callback reports the production Deployment.
- [ ] **P4-03** `feat(dashboard)` Production status view: "what commit is currently running in production?"
- [ ] **P4-04** `feat(dashboard)` Deployment diff link-out: given two Deployments, link to GitHub's compare view using their commit SHAs (ADR-0007).

## Phase 5 — Observability

- [ ] **P5-01** `feat(observability)` Control-plane's own Cloudflare API token for querying the Workers Observability Telemetry API — `.dev.vars` locally for now (Secrets Store lands in Phase 6).
- [ ] **P5-02** `feat(observability)` Query route: given an Environment, call Cloudflare's Telemetry API filtered by Worker + time range (ADR-0004).
- [ ] **P5-03** `feat(dashboard)` Recent-errors view: errors for an Environment since its latest Deployment. Answers "what errors appeared after the latest production deployment?"

## Phase 6 — Harden: Access + self-provisioning

- [ ] **P6-01** `feat(alchemy)` `alchemy.run.ts` for the platform's *own* infra: control-plane + dashboard Workers, D1 — the platform starts provisioning itself.
- [ ] **P6-02** `feat(infra)` Cloudflare Access resources in that same stack: `Access.Application` + `Access.Policy` (interactive IdP login) for the dashboard; `Access.ServiceToken` for GitHub Actions callers of the control-plane API (ADR-0005).
- [ ] **P6-03** `feat(api)` Access JWT verification middleware in the control-plane Worker — defense in depth, independent of the edge gate (ADR-0005).
- [ ] **P6-04** `feat(infra)` Migrate the control-plane's own fixed secrets to Cloudflare Secrets Store for deployed environments.
- [ ] **P6-05** `feat(ci)` *(Svelteflare repo)* Add `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET` secrets, sent alongside the existing per-project bearer token on every callback.
