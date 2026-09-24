# A managed project's credentials are minted by a one-time Alchemy bootstrap stack

Status: accepted. Partially implemented: the bootstrap stack mints the Cloudflare CI token; minting the bearer token and pushing the Access service-token credentials are still to do.
Date: 2026-09-22

[ADR-0001](./0001-alchemy-provisioning-driven-by-github-actions.md) never said how a managed project's credentials reach its repo secrets. Until now that was a human job: create a Cloudflare Custom Token in the dashboard, copy the control-plane bearer token out of a registration response, copy the Access service-token credentials out of the platform's deploy output, and paste all of them into a wizard that ran `gh secret set`. None of that was reviewable in a diff or reproducible on rotation.

**Decision:** each managed project provisions its own credentials with one small Alchemy stack (e.g. `alchemy/github.ts` in the managed project), run once by hand from an operator's machine — never from CI — and re-runnable to rotate. It:

- Mints a `Cloudflare.ApiToken.AccountApiToken` scoped to only the permission groups that project's own stack uses (for demo-project: Workers Scripts Write, D1 Write, Workers R2 Storage Write — never Access, Secrets Store, or Zero Trust org settings, which are platform concerns per [ADR-0005](./0005-cloudflare-access-in-front-of-dashboard-and-api.md)).
- Generates the control-plane bearer token locally (the same 256-bit CSPRNG + SHA-256 scheme as the control plane's `mintToken()`), and writes only its hash straight into the platform's `control-plane-db` D1 database with `wrangler d1 execute --remote` — an `INSERT` on first registration, an `UPDATE` on rotation.
- Pushes every value into the project's repo secrets (`CLOUDFLARE_API_TOKEN`, `IDP_PROJECT_TOKEN`, and — still to do — `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`) with `GitHub.Secret`. No value is ever printed or typed into a prompt.

## Considered Options

A control-plane route for registration (`POST /v1/projects` taking a `tokenHash`, plus a rotation route) was rejected: it would be a mutation route reachable by the Access service token that every managed project's CI shares, so any one project could register or rotate another. Writing to D1 directly keeps the API's token-issuance surface at zero. Revisit toward an API route if provisioning ever moves off a single operator's machine.

## Consequences

- The bootstrap script's insert-vs-update logic has no server-side guardrail.
- It needs `control-plane-db`'s name as a known constant, and `wrangler` authenticated separately from Alchemy's own Cloudflare profile (the two credential caches aren't shared).
- Minting a Cloudflare token needs a second, API-token-based Alchemy profile: Cloudflare's token-creation endpoint refuses OAuth sessions.
- Cloudflare permission groups are still account-wide, not scoped to one D1 database or R2 bucket. What changes is that credentials are minted narrowly, in code, and reproducibly.
