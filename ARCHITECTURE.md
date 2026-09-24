# Architecture

A lightweight, opinionated internal developer platform for applications running on Cloudflare. Central control plane for multiple Projects; ephemeral per-PR infrastructure, staging, and production, all provisioned by [Alchemy](https://alchemy.run); developers (and their coding agents) query deployment state through the dashboard or its REST API.

This document ties together the domain glossary ([`CONTEXT.md`](./CONTEXT.md)) and the individual architecture decisions ([`docs/adr/`](./docs/adr/)) into one picture. It documents the design, not the code.

## Components

- **Managed Projects** — applications onboarded into the platform, living in their own repositories (e.g. the Svelteflare boilerplate). Each owns its own GitHub Actions workflows.
- **Dashboard + control-plane API** — one SvelteKit app (Svelte UI, Hono API), running as a single Cloudflare Worker. The Hono app — system of record for Projects, Environments, Deployments, and CI results, D1-backed, see [ADR-0003](./docs/adr/0003-d1-only-no-durable-objects.md) — is mounted same-origin under `/v1/*`; the dashboard is the human-facing UI over it. `apps/control-plane` holds the API code as a workspace-internal library (not its own deploy target); `apps/dashboard` is what actually deploys. See [ADR-0009](./docs/adr/0009-platform-self-provisioning-stack.md).
- **Alchemy** — provisions the actual Cloudflare infrastructure (Workers, D1, etc.) per Project/Environment, executed from each managed Project's own GitHub Actions, not from the control plane. See [ADR-0001](./docs/adr/0001-alchemy-provisioning-driven-by-github-actions.md).
- **Cloudflare Access** — gates the whole dashboard + control-plane Worker. See [ADR-0005](./docs/adr/0005-cloudflare-access-in-front-of-dashboard-and-api.md) and [ADR-0011](./docs/adr/0011-one-access-application-identity-scoped-reads.md).

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

## Auth — four layers

1. **Per-Project write access** (a managed Project's GitHub Actions → control-plane API): an opaque token minted once per Project, stored hashed in D1, sent as `Authorization: Bearer`, held by the managed repo as a GitHub Actions secret. Deliberately per-project rather than a single shared signed token, so that a leaked credential (compromised third-party Action, malicious dependency install script, fork-PR misconfiguration, etc.) only ever exposes one Project.
2. **Perimeter** (can this request reach the Worker at all): Cloudflare Access in front of the one dashboard + control-plane Worker, declared as Alchemy resources in the same stack that provisions everything else — not a manual, skippable setup step. Its Access Application carries both an interactive-login policy (the dashboard's single allow-listed email, via Google login) and a Service Token policy (GitHub Actions) — Access alone only answers "some valid credential," not which kind. See [ADR-0005](./docs/adr/0005-cloudflare-access-in-front-of-dashboard-and-api.md).
3. **Defense in depth**: the Worker itself verifies the Access JWT server-side rather than trusting the network path alone, so the app stays non-functional even if Access were ever misconfigured at the edge.
4. **Read scoping**: the four control-plane reads that exist only for the dashboard (`GET /v1/projects`, its `/environments`, `GET /v1/environments/:id`, `GET /v1/deployments/:id`) require the verified Access JWT to carry an identity `email` claim — present for the operator's Google login, absent for a Service Token — so a leaked/shared CI credential can write only its own Project (surface #1) and can't read any Project's data at all. See [ADR-0011](./docs/adr/0011-one-access-application-identity-scoped-reads.md).

The control plane holds no Cloudflare API credential of its own at runtime (see [ADR-0012](./docs/adr/0012-no-platform-cloudflare-api-credential.md)) — its only bindings are `DB` and the plain Access strings (`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`). Alchemy's own deploy-time Cloudflare authentication is a local OAuth session (`alchemy profile`, cached to `~/.alchemy` on the deploying machine), never a Worker binding. How a managed project gets its own credentials (Cloudflare CI token, bearer token, Access service token) is covered by [ADR-0010](./docs/adr/0010-managed-project-credentials-from-a-bootstrap-stack.md).

## Control-plane API & dashboard conventions

Adopted directly from Svelteflare's Hono/SvelteKit patterns — the reference for dashboard design, project structure, and API patterns (not its tooling — see below):

- **Data layer**: Drizzle ORM over D1, schema in a single `schema.ts`, migrations via `drizzle-kit`.
- **App structure**: Hono app-factory pattern (`createApp(overrides)`), so the control-plane API is testable by dependency injection rather than global singletons.
- **API conventions**: routes mounted under `/v1`, composed in `routes/index.ts`; `requestId` and `secureHeaders` middleware on every request; a centralized `onError` handler returning sanitized JSON (no leaking internals or stack traces in responses); a `notFound` handler. Folder separation: `routes/`, `middleware/`, `helpers/`, `db/`.
- **Typed client**: the dashboard calls the control-plane API via Hono's `AppType` export (an RPC-style client, `hc<AppType>()`) for end-to-end type safety with zero codegen, over a same-origin `/v1/*` mounted in the dashboard's own Worker (see [ADR-0009](./docs/adr/0009-platform-self-provisioning-stack.md)). This couples the dashboard's build to the control-plane's types at compile time — accepted, since both live in the same pnpm workspace.
- **Control-plane module**: page loaders never touch the RPC client directly. `lib/api/controlPlane.ts` is the dashboard's one interface onto the control plane — the five reads the views need — and absorbs the HTTP failure protocol (502 unreachable, 401 expired Access session, 404 missing) and the response-union narrowing. It takes its client as a parameter, so its tests run the real control-plane app in-process over an in-memory SQLite database (`control-plane/testing`) rather than mocking the transport.
- **UI**: Tailwind + shadcn-svelte, built directly inside `apps/dashboard` — no separate shared `packages/ui`, since unlike Svelteflare this project has only one frontend to serve. Components installed via `pnpm dlx skills add huntabyte/shadcn-svelte` (plus the relevant Svelte skills), not hand-copied.
- **Local config**: a gitignored root `.env` (see `.env.example`) for deploy-time config (the Access team domain, Google IdP id, allow-listed email). `alchemy dev` needs none of it; `alchemy deploy` fails if the Access values are missing. There is no application secret in this file — see "Auth" above.

**Not adopted** from Svelteflare: better-auth, cookie/session-based login, and the Stripe/billing domain — all superseded by Cloudflare Access ([ADR-0005](./docs/adr/0005-cloudflare-access-in-front-of-dashboard-and-api.md)), which issues and manages its own session rather than the app rolling its own.

## Local development

Alchemy (`alchemy.run.ts` + `alchemy/`, [ADR-0009](./docs/adr/0009-platform-self-provisioning-stack.md)) owns build, dev, and deploy for the one dashboard + control-plane app. `pnpm dev` runs `alchemy dev`: SvelteKit's own Vite dev server, with `platform.env` carrying the real D1/Access bindings via Alchemy's platform proxy — no separate process for the API, since it's mounted in the same Worker. It needs a Cloudflare identity once (`alchemy profile edit --add Cloudflare`, cached to `~/.alchemy`, the same one-time step as `wrangler login`).

The Cloudflare Access resources are guarded out of `alchemy dev` (they have no local simulator), so local dev needs no Zero Trust org — the control-plane routes simply run ungated locally, which their JWT middleware already handles.

The dashboard's pages are a client-rendered SPA (`ssr` disabled); the `/v1/*` API routes are always server-rendered, same as any SvelteKit `+server.ts`. On deploy Alchemy swaps in its own Cloudflare adapter; the `@sveltejs/adapter-static` config stays for `svelte-check` and a standalone `vite build`.

This is separate from the CI-time test suites (the `vitest` unit suite runs in plain Node against an in-memory libsql DB; the live Integration Test suite runs against deployed staging).

## Tooling & repository conventions

- Monorepo: pnpm workspaces, `apps/*` + `packages/*` — layout inspired by Svelteflare's structure, not its tooling.
- Lint/format/typecheck: the newer Vite+ toolchain, including Oxlint/Oxfmt — explicitly *not* Svelteflare's ESLint/Prettier/Turborepo stack.
- Commits: Conventional Commits, validated by commitlint. Small, atomic, one logical change per commit. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for types, scopes, and examples.

## AI / agent interaction

No dedicated AI or agent interface in this version — no dashboard chat, no MCP server. The control-plane API is a plain REST API any HTTP-capable agent can already call directly once authenticated through Access. This explicitly leaves one of the original project goals unfulfilled rather than silently dropped — see [ADR-0008](./docs/adr/0008-no-ai-interface-this-version.md) for why, and what would justify revisiting it.

## Status

What is built and what comes next: [`docs/ROADMAP.md`](./docs/ROADMAP.md).
