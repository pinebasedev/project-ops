# Project Ops

A small, opinionated internal developer platform for apps that run on Cloudflare.

Every pull request gets its own isolated environment. Merging into `staging` deploys staging, and merging `staging` into `main` deploys production. A central dashboard shows what is deployed where, at which commit, and whether staging's live tests passed. Each managed project provisions itself with [Alchemy](https://alchemy.run) from its own GitHub Actions and reports to a control plane, and the whole platform sits behind Cloudflare Access.

> [!WARNING]
> **Early access.** This platform is built and run by a single operator, and parts of it have not yet been verified end to end on a real deploy. See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for what's built and what isn't. Expect rough edges and breaking changes.

## How it works

```
feature branch → PR against staging
  → unit tests
  → Alchemy provisions an isolated pr-{number} environment → preview URL on the PR
merge into staging
  → pr-{number} destroyed, staging redeployed, live tests run against it
merge staging into main
  → production deployed
```

The control plane never deploys anything. Each managed project's CI reports what it did, and the dashboard shows the history. Promotion is a plain Git merge.

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): components, lifecycle, and auth.
- [`CONTEXT.md`](./CONTEXT.md): the glossary (Project, Environment, Stage, Deployment, Promotion).
- [`docs/adr/`](./docs/adr/): the decisions behind the design, and why.
- [`docs/managed-projects.md`](./docs/managed-projects.md): what an app needs in order to be managed by the platform.

## Quick start (local)

Requires Node 24+ and [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm alchemy profile edit --add Cloudflare   # once: OAuth, cached to ~/.alchemy
pnpm dev
```

`pnpm dev` runs the dashboard and control-plane API against local simulators (a local SQLite D1). It touches nothing in your Cloudflare account, and the Access gate is off locally. The profile step is required because Alchemy needs a Cloudflare identity even for local runs. When asked about OAuth scopes, add `access:write` (see [`alchemy/README.md`](./alchemy/README.md)).

Checks:

```sh
pnpm check     # typecheck everything
pnpm test      # unit tests
pnpm lint
pnpm format:check
```

## Deploying

A real deploy needs a Cloudflare account with a Zero Trust organization and a Google identity provider. The deploy wizard walks you through it:

```sh
scripts/deploy-wizard.sh
```

It connects Alchemy to your account, collects the Zero Trust settings into a gitignored `.env`, and runs `alchemy deploy`. Then onboard an app with `scripts/onboard-project.sh`.

## Repository layout

| Path | What it is |
|---|---|
| `apps/control-plane` | The control-plane API (Hono + Drizzle on D1). A library mounted by the dashboard, not deployed on its own. |
| `apps/dashboard` | The SvelteKit dashboard, and the one Worker that is deployed. Serves the API at `/v1/*`. |
| `alchemy.run.ts`, `alchemy/` | The Alchemy stack that provisions the platform itself. |
| `scripts/` | The deploy and onboarding wizards. |
| `docs/` | ADRs, roadmap, and the managed-project contract. |

## Contributing

Small, clearly correct fixes are welcome. For anything larger, open a discussion first. See [`CONTRIBUTING.md`](./CONTRIBUTING.md). To report a vulnerability, see [`SECURITY.md`](./SECURITY.md).

## Credits

Built on [Alchemy](https://alchemy.run), [Hono](https://hono.dev), [SvelteKit](https://svelte.dev/docs/kit), [Drizzle ORM](https://orm.drizzle.team), [shadcn-svelte](https://shadcn-svelte.com), and [Cloudflare Workers](https://workers.cloudflare.com). The dashboard and API conventions follow the Svelteflare boilerplate.

## License

[MIT](./LICENSE)
