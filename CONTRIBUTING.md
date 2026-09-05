# Contributing

## Commit strategy

This repo uses [Conventional Commits](https://www.conventionalcommits.org/), enforced by [commitlint](https://commitlint.js.org/).

```
<type>(<scope>): <short imperative description>
```

### Types

- `feat` — new functionality
- `fix` — bug fixes
- `refactor` — internal restructuring without changing behavior
- `test` — tests
- `docs` — documentation
- `chore` — maintenance/tooling
- `ci` — CI/CD configuration
- `build` — build-system changes
- `perf` — performance improvements

### Scopes

`control-plane`, `api`, `dashboard`, `ci`, `alchemy`, `infra`, `db`, `observability`, `integration`, `tooling`, `docs`, `architecture`

(`ai` is deliberately not in this list — see [ADR-0008](./docs/adr/0008-no-ai-interface-this-version.md). Re-add it if that decision is revisited.)

### Examples

```
feat(control-plane): add deployment registry
feat(ci): provision PR preview environments
fix(ci): prevent stale preview deployments
test(integration): verify PR environment cleanup
chore(tooling): configure Vite+ linting
docs(architecture): document deployment lifecycle
```

Avoid vague messages: `updates`, `fix stuff`, `changes`, `wip`, `misc fixes`.

### commitlint config (reference — not wired up yet)

Once the repo has a `package.json`/pnpm workspace, this is the intended `commitlint.config.js`, enforced via a Husky `commit-msg` hook running `commitlint --edit $1`:

```js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'ci', 'build', 'perf'],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'control-plane',
        'api',
        'dashboard',
        'ci',
        'alchemy',
        'infra',
        'db',
        'observability',
        'integration',
        'tooling',
        'docs',
        'architecture',
      ],
    ],
    'scope-empty': [2, 'never'],
  },
};
```

`extends: ['@commitlint/config-conventional']` gives the Conventional Commits baseline (format, casing, `BREAKING CHANGE:` footer support); the overrides lock `type` and `scope` to exactly the lists above instead of accepting anything, and `scope-empty` makes a scope mandatory.

### Rules

- Commits are small, atomic, and logically coherent. Don't combine unrelated changes into one commit — split them.
- Before every commit: inspect the diff, determine the single logical change it represents, split if necessary, run the relevant checks/tests, then write a message describing the *intent* of the change, not a list of which files changed.
- Add a commit body when the change needs context a future reader wouldn't have — why it was made, and any real trade-off behind it.
- Use a `BREAKING CHANGE:` footer only for a genuinely breaking interface or behavior change.
- Don't commit just because a checklist item was completed. Commit when the repo has reached a coherent, working state representing one logical change.
