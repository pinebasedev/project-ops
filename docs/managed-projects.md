# Onboarding a managed project

A managed Project is an application in its own GitHub repository. It provisions its own infrastructure with Alchemy from its own GitHub Actions ([ADR-0001](./adr/0001-alchemy-provisioning-driven-by-github-actions.md)) and reports each Deployment to the control plane. The platform never deploys anything itself; it records what the project's CI tells it.

`scripts/onboard-project.sh` walks through the setup below. `demo-project` was the first managed project and is the reference implementation.

## What the project's repository needs

**An Alchemy stack** (`alchemy.run.ts`) parameterized by stage, using Alchemy's remote state (`Cloudflare.state()`), since GitHub-hosted runners keep no files between runs. Stage names:

| Stage | Environment kind | Deployed when |
|---|---|---|
| `pr-{number}` | `ephemeral` | A PR against `staging` is opened or updated; destroyed when it closes |
| `staging` | `staging` | A PR is merged into `staging` |
| `prod` | `production` | `staging` is merged into `main` ([ADR-0002](./adr/0002-promotion-is-a-git-merge.md)) |

No workflow should ever be able to destroy `staging` or `prod`.

**A one-time credential bootstrap stack**, run by hand from an operator's machine, that mints the project's own Cloudflare CI token and control-plane bearer token and pushes them into the repo's secrets ([ADR-0010](./adr/0010-managed-project-credentials-from-a-bootstrap-stack.md)).

**GitHub Actions secrets and variables:**

| Name | Kind | Set by |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | secret | the bootstrap stack |
| `CLOUDFLARE_ACCOUNT_ID` | secret | the bootstrap stack |
| `IDP_PROJECT_TOKEN` | secret | the bootstrap stack (its hash is written to the platform's D1) |
| `CF_ACCESS_CLIENT_ID` | secret | `scripts/onboard-project.sh` |
| `CF_ACCESS_CLIENT_SECRET` | secret | `scripts/onboard-project.sh` |
| `IDP_API_URL` | variable | `scripts/onboard-project.sh` (the platform's URL) |

Keep anything identifying in secrets rather than variables if the repository is public: GitHub prints variables unmasked in Actions logs.

## The callback contract

Every call goes to `$IDP_API_URL` with three headers: `Authorization: Bearer $IDP_PROJECT_TOKEN`, `CF-Access-Client-Id`, and `CF-Access-Client-Secret`.

1. **Before deploying**, register the Deployment:

   ```
   POST /v1/deployments
   {"stageName": "pr-42", "kind": "ephemeral", "commitSha": "<sha>", "prNumber": 42}
   → {"deploymentId": "..."}
   ```

   `kind` is `ephemeral`, `staging`, or `production`. `prNumber` is optional. The Environment is created on first use.

2. **After deploying**, report the outcome:

   ```
   POST /v1/deployments/:id/complete
   {"status": "done", "previewUrl": "https://..."}   or   {"status": "failed"}
   ```

3. **Optionally, after the live test suite runs against staging** ([ADR-0006](./adr/0006-integration-tests-run-once-on-staging.md)):

   ```
   POST /v1/deployments/:id/integration-results
   {"passed": 12, "failed": 0, "runUrl": "https://github.com/.../actions/runs/..."}
   ```

A project's token can only write its own Deployments. There is no destroy callback: a closed PR's environment stays listed in the dashboard.
