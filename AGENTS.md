# AGENTS.md

An internal developer platform for Cloudflare apps. Read [`CONTEXT.md`](./CONTEXT.md) and use its terms (Project, Environment, Stage, Deployment, Promotion). [`ARCHITECTURE.md`](./ARCHITECTURE.md) explains how the pieces fit, and [`docs/adr/`](./docs/adr/) explains why.

## Layout

- `apps/api`: the control-plane API, Hono over D1 (Drizzle). It is a **library**, not a deploy target: the web app mounts it at `/v1/*` in `apps/web/src/routes/v1/[...rest]/+server.ts`. It has no wrangler config of its own.
- `apps/web`: the dashboard, SvelteKit, client-rendered (`ssr = false`), and the one Worker that is deployed.
- `alchemy.run.ts` + `alchemy/`: the Alchemy stack. Alchemy owns build, dev, and deploy. It is Alchemy v2, which is Effect-based, so check `node_modules/alchemy` for its current API rather than relying on memory.
- `scripts/`: interactive wizards for the human operator.

## Working here

- Verify with `pnpm check && pnpm test && pnpm lint && pnpm format:check`.
- **Local only.** `pnpm dev` (`alchemy dev`) and the test suites touch nothing remote. `alchemy deploy`/`destroy`, `wrangler … --remote`, and the wizards act on a real Cloudflare account, and the human operator runs them.
- API tests run in Node against an in-memory libsql database. Web tests of `lib/api/controlPlane.ts` run the real API app in-process (`api/testing`), so extend that setup rather than mocking the transport.
- For a schema change, edit `apps/api/src/db/schema.ts` and run `pnpm --filter api db:generate`. Alchemy applies migrations on deploy.
- Access is off under `alchemy dev` (`ALCHEMY_DEV` guard) and the JWT middleware runs ungated when `CF_ACCESS_AUD` is unset. That is the intended local state, not a bug.
- Every change must keep the auth layers in [`ARCHITECTURE.md`](./ARCHITECTURE.md#auth--four-layers) intact.
- A change to an accepted decision gets a new ADR ([`docs/adr/README.md`](./docs/adr/README.md)), and the old ADR's `Status:` line points to it. The old ADR's body stays as written.
- Commits: Conventional Commits with a required scope from [`commitlint.config.js`](./commitlint.config.js), one logical change each. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- Agent skills for Cloudflare, Hono, Svelte, and shadcn-svelte are pinned in each directory's `skills-lock.json`. Restore them with `pnpm dlx skills experimental_install`.
