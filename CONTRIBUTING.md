# Contributing

This is a single-maintainer project, and reviewing changes takes much more effort than writing them. So:

- **Small, clearly correct fixes are welcome**: a bug fix whose full effect is obvious from reading the patch.
- **For anything bigger**, such as a feature, a refactor, or a design change, [open an issue](../../issues/new/choose) to discuss it first. A large PR without one will likely be closed with a pointer here.
- **For bugs**, open an issue first if you aren't sure of the fix.
- **For security issues**, see [`SECURITY.md`](./SECURITY.md). Don't file them publicly.

Design context lives in [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`CONTEXT.md`](./CONTEXT.md) (use its terms), and [`docs/adr/`](./docs/adr/). A change that goes against an accepted ADR needs a new ADR, not just a PR.

## Development

See the README's quick start. Before opening a PR:

```sh
pnpm check && pnpm test && pnpm lint && pnpm format:check
```

The agent skills used while building this (Cloudflare, Hono, Svelte, shadcn-svelte) aren't committed. Restore them with `pnpm dlx skills experimental_install`, run from each directory that has a `skills-lock.json`.

## What CI runs on your PR

[`ci.yml`](.github/workflows/ci.yml) runs format check, lint, typecheck, tests, and `shellcheck` on every pull request, including PRs from forks. It uses no secrets, and nothing in this repository deploys from CI: the platform is deployed from an operator's machine (`scripts/deploy-wizard.sh`). Workflows from first-time contributors wait for maintainer approval before running.

## Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint ([`commitlint.config.js`](./commitlint.config.js)) through a Husky `commit-msg` hook.

```
<type>(<scope>): <short imperative description>
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`.

**Scopes** (required): `control-plane`, `api`, `dashboard`, `ci`, `alchemy`, `infra`, `db`, `observability`, `integration`, `tooling`, `docs`, `architecture`. There is deliberately no `ai` scope; see [ADR-0008](./docs/adr/0008-no-ai-interface-this-version.md).

```
feat(control-plane): add deployment registry
fix(ci): prevent stale preview deployments
docs(architecture): document deployment lifecycle
```

- Keep commits small and atomic: one logical change each, with unrelated changes split out.
- Describe the *intent* of the change, not which files changed. Messages like `updates` or `fix stuff` will be rejected.
- Add a body when a future reader would need context: why the change was made, and any real trade-off behind it.
- Use a `BREAKING CHANGE:` footer only for a genuinely breaking interface or behavior change.
