# Cloudflare Access protects both the dashboard and the API, provisioned as code

Status: accepted — see the Phase 6 update below on the dashboard IdP

Both the dashboard and the control-plane API sit behind Cloudflare Access (Zero Trust). The Access application, policy, and service tokens are declared as Alchemy resources in the same stack that provisions the rest of the project (`Cloudflare.Access.Application`, `Access.Policy`, `Access.Group`, `Access.ServiceToken`) — not a manual, skippable step taken separately in Cloudflare's dashboard. This makes Access mandatory for anyone deploying this project: `alchemy deploy` will not stand up a reachable, working system without it.

- **Dashboard**: an Access Policy requiring interactive IdP login (GitHub), scoped to an allow-listed email/group.
- **Control-plane API**: an Access Policy requiring a valid Access Service Token. Managed projects' GitHub Actions workflows authenticate with a `CF-Access-Client-Id`/`CF-Access-Client-Secret` pair (an `Access.ServiceToken` resource). The local MCP server authenticates via `cloudflared access login`'s cached interactive session.
- **Defense in depth**: the Worker itself also verifies the `Cf-Access-Jwt-Assertion` header server-side (against the Zero Trust team's JWKS), rather than trusting the network path alone. The app stays non-functional even if Access were ever misconfigured or bypassed at the edge.

This sits entirely on top of, and independent from, the per-project bearer tokens ([[CONTEXT]]: `Project`) used to authorize *which* Project a write belongs to — Access answers "can this request reach the Worker at all," the per-project token still answers "which project." A leaked Access service token doesn't expose project data on its own; a request still needs a valid per-project token to write anything.

## Consequences

Every managed project's GitHub Actions workflow needs two more repo secrets (`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`) alongside `CLOUDFLARE_API_TOKEN` and `IDP_PROJECT_TOKEN` — four total. Anyone self-hosting this project needs a Cloudflare Zero Trust org (free tier covers small user counts); this is now a hard dependency of the project, not an optional hardening step.

## Update (2026-09, Phase 6)

The dashboard IdP is **Google**, not GitHub as written above — GitHub was a placeholder before the org existed, and the founder's identity is a Google account. The allow-list is a single email (`CF_ACCESS_ALLOW_EMAIL`, defaulting to the founder's) rather than an email domain or group. Everything else holds. The concrete stack — `alchemy/Access.ts` + `alchemy.run.ts` — and the deploy procedure are covered by [ADR-0009](./0009-platform-self-provisioning-stack.md).

## Update (2026-09, credential provisioning)

The `Access.ServiceToken` this ADR describes is already provisioned as code (`alchemy/Access.ts`), but its `clientId`/`clientSecret` currently reach a managed project the same ad hoc way `CLOUDFLARE_API_TOKEN` did: printed in the platform's `alchemy deploy` output, read by a human, pasted into `scripts/phase-6-deploy.sh`, then `gh secret set` by the wizard. Per the credential-provisioning update in [ADR-0001](./0001-alchemy-provisioning-driven-by-github-actions.md), this should instead flow directly from the platform's own deploy into the managed project's repo via `GitHub.Secret` — no manual copy-paste step, and rotation just means redeploying rather than a human running the wizard again. Not yet implemented; tracked alongside ADR-0001's follow-up.
