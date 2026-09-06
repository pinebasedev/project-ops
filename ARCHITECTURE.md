# Architecture

A lightweight, opinionated internal developer platform for applications running on Cloudflare. Central control plane for multiple Projects; ephemeral per-PR infrastructure, staging, and production, all provisioned by [Alchemy](https://alchemy.run); developers (and their coding agents) query deployment state through an MCP server.

This document ties together the domain glossary ([`CONTEXT.md`](./CONTEXT.md)) and the individual architecture decisions ([`docs/adr/`](./docs/adr/)) into one picture. It documents decisions, not code — nothing here has been implemented yet.

## Components

- **Managed Projects** — applications onboarded into the platform, living in their own repositories (e.g. the Svelteflare boilerplate). Each owns its own GitHub Actions workflows.
- **Control-plane API** — Hono, running as a Cloudflare Worker. System of record for Projects, Environments, Deployments, and CI results. D1-backed. See [ADR-0003](./docs/adr/0003-d1-only-no-durable-objects.md).
- **Dashboard** — Svelte, running as a separate Cloudflare Worker. Human-facing UI over the control-plane API.
- **Alchemy** — provisions the actual Cloudflare infrastructure (Workers, D1, etc.) per Project/Environment, executed from each managed Project's own GitHub Actions, not from the control plane. See [ADR-0001](./docs/adr/0001-alchemy-provisioning-driven-by-github-actions.md).
- **Cloudflare Access** — gates both the dashboard and the control-plane API. See [ADR-0005](./docs/adr/0005-cloudflare-access-in-front-of-dashboard-and-api.md).
- **Cloudflare Workers Observability** — queried directly by the control plane for logs/errors; not relayed or duplicated. See [ADR-0004](./docs/adr/0004-query-observability-directly.md).

The control plane never provisions infrastructure or drives deployments itself — it only observes and records what GitHub Actions and Alchemy do, and answers questions about that history.

## Lifecycle

```
feature branch
  → open PR against `staging`
  → unit tests (CI merge gate, before any infra exists)
  → Alchemy provisions isolated PR infrastructure (stage `pr-{number}`)
  → preview deployment + preview URL (posted as a PR comment by Alchemy's GitHub.Comment resource)
  → new commits → unit tests again → same PR environment redeployed (same stage name)
  → PR merged into `staging`
      → PR infrastructure destroyed (`alchemy destroy --stage pr-{number}`, guarded against ever targeting prod)
      → `staging` Environment redeploys (stage `staging`)
      → Integration Tests run once, live, against staging
  → human reviews staging (dashboard shows current deployment + test status)
  → promotion: `staging` branch merged into `main` — a plain git merge, no dashboard action, no automated gate
      → `main` merge deploys `production` Environment (stage `prod`)
```

Terms: [`Project`](./CONTEXT.md), [`Environment`](./CONTEXT.md), [`Stage`](./CONTEXT.md), [`Deployment`](./CONTEXT.md), [`Integration Test`](./CONTEXT.md), [`Promotion`](./CONTEXT.md). Why integration tests run once on staging rather than per PR: [ADR-0006](./docs/adr/0006-integration-tests-run-once-on-staging.md). Why promotion is a git merge, not a control-plane action: [ADR-0002](./docs/adr/0002-promotion-is-a-git-merge.md).

## Auth — three separate surfaces

1. **Per-Project write access** (a managed Project's GitHub Actions → control-plane API): an opaque token minted once per Project, stored hashed in D1, sent as `Authorization: Bearer`, held by the managed repo as a GitHub Actions secret. Deliberately per-project rather than a single shared signed token, so that a leaked credential (compromised third-party Action, malicious dependency install script, fork-PR misconfiguration, etc.) only ever exposes one Project.
2. **Perimeter** (can this request reach either Worker at all): Cloudflare Access in front of both the dashboard and the control-plane API, declared as Alchemy resources in the same stack that provisions everything else — not a manual, skippable setup step. Interactive IdP login for the dashboard; an Access Service Token for GitHub Actions. See [ADR-0005](./docs/adr/0005-cloudflare-access-in-front-of-dashboard-and-api.md).
3. **Defense in depth**: the Worker itself verifies the Access JWT server-side rather than trusting the network path alone, so the app stays non-functional even if Access were ever misconfigured at the edge.

The control plane's own fixed operational secrets (Access-related credentials, the token used to query Workers Observability, etc.) live in Cloudflare Secrets Store — a different category from the per-project tokens above, since Secrets Store is for values the app reads at deploy time, not credentials created dynamically per Project at runtime.

## Control-plane API & dashboard conventions

Adopted directly from Svelteflare's Hono/SvelteKit patterns — the reference repo for dashboard design, project structure, and API patterns per the project's original brief (not its tooling — see below):

- **Data layer**: Drizzle ORM over D1, schema in a single `schema.ts`, migrations via `drizzle-kit`.
- **App structure**: Hono app-factory pattern (`createApp(overrides)`), so the control-plane API is testable by dependency injection rather than global singletons.
- **API conventions**: routes mounted under `/v1`, composed in `routes/index.ts`; `requestId` and `secureHeaders` middleware on every request; a centralized `onError` handler returning sanitized JSON (no leaking internals or stack traces in responses); a `notFound` handler. Folder separation: `routes/`, `middleware/`, `helpers/`, `db/`.
- **Typed client**: the dashboard calls the control-plane API via Hono's `AppType` export (an RPC-style client, `hc<AppType>()`) for end-to-end type safety with zero codegen. This couples the dashboard's build to the control-plane's types at compile time — accepted, since both live in the same pnpm workspace.
- **UI**: Tailwind + shadcn-svelte, built directly inside `apps/dashboard` — no separate shared `packages/ui`, since unlike Svelteflare this project has only one frontend to serve. Components installed via `pnpm dlx skills add huntabyte/shadcn-svelte` (plus the relevant Svelte skills), not hand-copied.
- **Local secrets**: a gitignored root `.env` (optional) for the control plane's own fixed secrets during local development, mirroring what's held in Cloudflare Secrets Store once deployed; each has a dev fallback so `alchemy dev` runs without it.

**Not adopted** from Svelteflare: better-auth, cookie/session-based login, and the Stripe/billing domain — all superseded by Cloudflare Access ([ADR-0005](./docs/adr/0005-cloudflare-access-in-front-of-dashboard-and-api.md)), which issues and manages its own session rather than the app rolling its own.

## Local development

From Phase 6 on, Alchemy (`alchemy.run.ts` + `alchemy/`, [ADR-0009](./docs/adr/0009-platform-self-provisioning-stack.md)) owns build, dev, and deploy for both apps. `pnpm dev` runs `alchemy dev`: the control-plane in the real `workerd` runtime, a local SQLite D1, and the dashboard on SvelteKit's own vite dev server — all against local simulators, nothing remote. It needs a Cloudflare identity once (`alchemy login`, cached to `~/.alchemy`, the same one-time step as `wrangler login`).

The Cloudflare Access resources and the Secrets Store entry are guarded out of `alchemy dev` (they have no local simulator), so local dev needs no Zero Trust org — the control-plane simply runs ungated locally, which its JWT middleware already handles.

The dashboard is a client-rendered SPA (`ssr` disabled). On deploy Alchemy swaps in its own Cloudflare adapter; the `@sveltejs/adapter-static` config stays for `svelte-check` and a standalone `vite build`.

This is separate from the CI-time test suites (the `vitest` unit suite runs in plain Node against an in-memory libsql DB; the live Integration Test suite runs against deployed staging).

## Tooling & repository conventions

- Monorepo: pnpm workspaces, `apps/*` + `packages/*` — layout inspired by Svelteflare's structure, not its tooling.
- Lint/format/typecheck: the newer Vite+ toolchain, including Oxlint/Oxfmt — explicitly *not* Svelteflare's ESLint/Prettier/Turborepo stack.
- Commits: Conventional Commits, validated by commitlint. Small, atomic, one logical change per commit. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for types, scopes, and examples.

## AI / agent interaction

No dedicated AI or agent interface in this version — no dashboard chat, no MCP server. The control-plane API is a plain REST API any HTTP-capable agent can already call directly once authenticated through Access. This explicitly leaves one of the original project goals unfulfilled rather than silently dropped — see [ADR-0008](./docs/adr/0008-no-ai-interface-this-version.md) for why, and what would justify revisiting it.

## Implementation

Full build-order ticket sequence: [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## Open items

Not yet settled — flagged here so they aren't silently assumed:
- Plan-tier/retention limits of the Workers Observability Telemetry API — noted as unconfirmed in [ADR-0004](./docs/adr/0004-query-observability-directly.md), worth checking before relying on it.
