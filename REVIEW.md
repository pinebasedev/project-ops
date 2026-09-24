# Review guidelines

For AI and human reviewers of pull requests. How to build and work in the repo is in [`AGENTS.md`](./AGENTS.md); which changes are accepted at all is in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Priority, highest first: the auth invariants, secret leakage, drift from the ADRs, then everything else.

## Auth invariants

The platform has four auth layers ([`ARCHITECTURE.md`](./ARCHITECTURE.md#auth--four-layers)). Flag any change that weakens one of them.

- **Every `/v1` route except `/v1/health` passes the Access JWT middleware** (`apps/control-plane/src/middleware/accessJwt.ts`). A new route mounted outside it, or a new exemption, is a finding.
- **Dashboard read routes require an identity login.** Every `GET` that returns project data goes through `requireIdentityMiddleware` (an `email` claim on the verified JWT). Service-token callers (CI) must not be able to read any project's data ([ADR-0011](./docs/adr/0011-one-access-application-identity-scoped-reads.md)).
- **Write routes are scoped by the per-project bearer token.** A route that writes a Deployment must go through `bearerAuthMiddleware` and act only on the authenticated project's own rows (see `findOwnedDeployment`). A write that trusts a project ID from the request body or path is a finding.
- **The control plane never issues tokens.** No route may mint, return, or rotate a bearer token ([ADR-0010](./docs/adr/0010-managed-project-credentials-from-a-bootstrap-stack.md)). Tokens are stored only as SHA-256 hashes.
- **The platform holds no Cloudflare API credential.** The Worker's bindings are `DB` and the plain Access strings. Reject a new Cloudflare token, account-scoped secret, or Secrets Store binding ([ADR-0012](./docs/adr/0012-no-platform-cloudflare-api-credential.md)).
- **The control plane never calls GitHub's API** ([ADR-0007](./docs/adr/0007-no-github-api-access-link-out-instead.md)).
- **Access resources are provisioned in `alchemy.run.ts` / `alchemy/Access.ts`**, never documented as a manual setup step. On deploy, the allow-listed email and IdP id have no default value.

## Secrets in logs and errors

- Log only through the structured logger (`helpers/logger.ts`). Never log a bearer token, an Access JWT or its claims beyond `email`, `CF-Access-Client-Secret`, or request/response bodies.
- Error responses are sanitized JSON from the central `onError` handler: no stack traces, no internal messages.
- Scripts pass secrets to `gh` on stdin, not as command-line arguments.

## Design drift

- Terms follow [`CONTEXT.md`](./CONTEXT.md). Flag a new synonym for an existing concept, such as "stage" used where the platform-level concept is an Environment.
- A change that contradicts an accepted ADR needs a new ADR in the same PR.
- The control plane observes and records. It never deploys, destroys, or gates a promotion ([ADR-0002](./docs/adr/0002-promotion-is-a-git-merge.md)).
- Page loaders call the control plane only through `apps/dashboard/src/lib/api/controlPlane.ts`, never the RPC client directly.
