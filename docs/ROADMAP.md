# Roadmap

Where the platform stands and what comes next. The design is in [`ARCHITECTURE.md`](../ARCHITECTURE.md); individual decisions are in [`docs/adr/`](./adr/).

## Built

**Control-plane API** (`apps/api`)
- D1 schema for Projects, Environments (`ephemeral` / `staging` / `production`), and Deployments, with Drizzle migrations.
- Per-project bearer tokens, stored hashed, for managed projects' CI to write their own Deployments.
- Callback routes: register a Deployment, complete it (`done` / `failed`, preview URL), and record live test results ([`docs/managed-projects.md`](./managed-projects.md)).
- Read routes for the dashboard, restricted to identity logins ([ADR-0011](./adr/0011-one-access-application-identity-scoped-reads.md)).
- Server-side Cloudflare Access JWT verification.

**Dashboard** (`apps/web`)
- A project's active PR environments, with status, commit, and preview link.
- Staging view: current Deployment and live test results.
- Production view: the commit currently running in production.
- A "compare with production" link to GitHub's compare view ([ADR-0007](./adr/0007-no-github-api-access-link-out-instead.md)).

**Provisioning**
- One Alchemy stack deploys the platform itself, behind Cloudflare Access ([ADR-0009](./adr/0009-platform-self-provisioning-stack.md)).
- A deploy wizard (`scripts/deploy-wizard.sh`) and an onboarding wizard for managed projects (`scripts/onboard-project.sh`).
- Verified end to end on a real deploy: a managed project deploys PR environments, staging, and production from its own GitHub Actions, and the dashboard reflects each one.

## Next

- **Credential bootstrap**, finished: the bootstrap stack also mints the bearer token and pushes the Access service-token credentials ([ADR-0010](./adr/0010-managed-project-credentials-from-a-bootstrap-stack.md)).
- **Integration and end-to-end tests:** they live in each managed project's repository for now, reporting results through the callback ([ADR-0006](./adr/0006-integration-tests-run-once-on-staging.md)). Shared test tooling may move into this repo later.
- **Destroyed environments:** record when a PR environment is torn down, so closed PRs drop out of the dashboard.

## Not planned

- A dashboard "Promote" button — promotion is a Git merge ([ADR-0002](./adr/0002-promotion-is-a-git-merge.md)).
- Calling GitHub's API, or storing per-test results ([ADR-0007](./adr/0007-no-github-api-access-link-out-instead.md)).
- A dedicated AI/agent interface such as an MCP server, in this version ([ADR-0008](./adr/0008-no-ai-interface-this-version.md)).
- Error/log views in the dashboard — the Cloudflare dashboard already has them ([ADR-0012](./adr/0012-no-platform-cloudflare-api-credential.md)).
- Durable Objects for control-plane state ([ADR-0003](./adr/0003-d1-only-no-durable-objects.md)).
