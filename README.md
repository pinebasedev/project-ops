# Project Ops

**v0.1**: previews, staging, and production for your Cloudflare apps, with one dashboard to follow them.

Project Ops is one place to manage your projects on Cloudflare. Today it tracks deployments: every pull request gets its own preview environment, and the dashboard shows what is deployed where and at which commit. It is meant to grow into the place where you see and manage much more of each project on the Cloudflare platform.

It works with any app that follows the [managed-project contract](./docs/managed-projects.md). [Svelteflare](https://github.com/pinebasedev/svelteflare) is set up for it out of the box.

> [!WARNING]
> **Actively developed.** Expect rough edges and breaking changes between versions. See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for what's built and what's next.

## How it works

```
feature branch → PR against staging
  → unit tests
  → Alchemy provisions an isolated pr-{number} environment → preview URL on the PR
merge into staging
  → pr-{number} destroyed (also when a PR closes unmerged)
  → staging redeployed, optional live tests report their results
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
| `apps/api` | The control-plane API (Hono + Drizzle on D1). A library mounted by the web app, not deployed on its own. |
| `apps/web` | The SvelteKit dashboard, and the one Worker that is deployed. Serves the API at `/v1/*`. |
| `alchemy.run.ts`, `alchemy/` | The Alchemy stack that provisions the platform itself. |
| `scripts/` | The deploy and onboarding wizards. |
| `docs/` | ADRs, roadmap, and the managed-project contract. |

## Contributing

Small, clearly correct fixes are welcome. For anything larger, open an issue to discuss it first. See [`CONTRIBUTING.md`](./CONTRIBUTING.md). To report a vulnerability, see [`SECURITY.md`](./SECURITY.md).

## Credits

Built on [Alchemy](https://alchemy.run), [Hono](https://hono.dev), [SvelteKit](https://svelte.dev/docs/kit), [Drizzle ORM](https://orm.drizzle.team), [shadcn-svelte](https://shadcn-svelte.com), and [Cloudflare Workers](https://workers.cloudflare.com).

## License

[MIT](./LICENSE)
