# Cloudflare Access protects both the dashboard and the API, provisioned as code

Status: accepted — see the Phase 6 update below on the dashboard IdP

Both the dashboard and the control-plane API — one SvelteKit Worker, the API mounted same-origin at `/v1/*` (ADR-0009) — sit behind Cloudflare Access (Zero Trust). The Access application, policy, and service tokens are declared as Alchemy resources in the same stack that provisions the rest of the project (`Cloudflare.Access.Application`, `Access.Policy`, `Access.Group`, `Access.ServiceToken`) — not a manual, skippable step taken separately in Cloudflare's dashboard. This makes Access mandatory for anyone deploying this project: `alchemy deploy` will not stand up a reachable, working system without it.

- **One Access Application, two policies**: an interactive-login policy (`allow-team`, single-email allowlist) for the dashboard's founder-only login, and a Service Token policy (`allow-ci`) for managed projects' GitHub Actions workflows, which authenticate with a `CF-Access-Client-Id`/`CF-Access-Client-Secret` pair (an `Access.ServiceToken` resource). The local MCP server authenticates via `cloudflared access login`'s cached interactive session. Access alone only answers "does this request carry *some* valid credential" — which kind, and which routes it may reach, is a server-side concern (see "read scoping" below).
- **Defense in depth**: the Worker itself also verifies the `Cf-Access-Jwt-Assertion` header server-side (against the Zero Trust team's JWKS), rather than trusting the network path alone. The app stays non-functional even if Access were ever misconfigured or bypassed at the edge.

This sits entirely on top of, and independent from, the per-project bearer tokens ([[CONTEXT]]: `Project`) used to authorize *which* Project a write belongs to — Access answers "can this request reach the Worker at all," the per-project token still answers "which project." A leaked Access service token doesn't expose project data on its own; a request still needs a valid per-project token to write anything.

## Consequences

Every managed project's GitHub Actions workflow needs two more repo secrets (`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`) alongside `CLOUDFLARE_API_TOKEN` and `IDP_PROJECT_TOKEN` — four total. Anyone self-hosting this project needs a Cloudflare Zero Trust org (free tier covers small user counts); this is now a hard dependency of the project, not an optional hardening step.

## Update (2026-09, Phase 6)

The dashboard IdP is **Google**, not GitHub as written above — GitHub was a placeholder before the org existed, and the founder's identity is a Google account. The allow-list is a single email (`CF_ACCESS_ALLOW_EMAIL`, defaulting to the founder's) rather than an email domain or group. Everything else holds. The concrete stack — `alchemy/Access.ts` + `alchemy.run.ts` — and the deploy procedure are covered by [ADR-0009](./0009-platform-self-provisioning-stack.md).

## Update (2026-09, credential provisioning)

The `Access.ServiceToken` this ADR describes is already provisioned as code (`alchemy/Access.ts`), but its `clientId`/`clientSecret` currently reach a managed project the same ad hoc way `CLOUDFLARE_API_TOKEN` did: printed in the platform's `alchemy deploy` output, read by a human, pasted into `scripts/phase-6-deploy.sh`, then `gh secret set` by the wizard. Per the credential-provisioning update in [ADR-0001](./0001-alchemy-provisioning-driven-by-github-actions.md), this should instead flow directly from the platform's own deploy into the managed project's repo via `GitHub.Secret` — no manual copy-paste step, and rotation just means redeploying rather than a human running the wizard again. Not yet implemented; tracked alongside ADR-0001's follow-up.

## Update (2026-09, read scoping)

Paragraph 11 above establishes that a leaked Access service token can't *write* project data on its own — the per-project bearer token still gates that. It said nothing about *reads*, and until now nothing needed to: `GET /v1/projects`, `GET /v1/projects/:id/environments`, `GET /v1/environments/:id`, and `GET /v1/deployments/:id` had no scoping beyond the Access gate itself. Since every managed project's CI shares the *same* `allow-ci` Service Token, any of them could read every other project's environments and deployments. These routes exist only for the dashboard — nothing in this codebase has CI ever calling a `GET` route, only `POST`.

That gap existed because the control-plane's `Access.Application` had *only* the `allow-ci` policy — no identity policy at all — so the dashboard's own Google-login session couldn't reach the API either. Two symptoms, one cause: Access wasn't told about the operator, only about CI.

**Decision:** put `allow-team` and `allow-ci` on the same `Access.Application`, rather than standing up a second, path-scoped Application to split reads from writes. Access alone then answers only "does this request carry *some* valid credential" — the read/write split moves server-side, onto claims the JWT already carries: a Google-identity login has an `email` claim, a service-token login doesn't. `middleware/requireIdentity.ts` checks exactly that, applied to the four read routes above; the three bearer-scoped write routes are untouched, since the dashboard has no bearer token and structurally can't call them regardless. A second Application was considered — it would enforce the split at the perimeter, unbreakable by a route-handler bug — but rejected as more infrastructure than a single-operator platform needs.

Since the dashboard and control-plane API are now one Worker rather than two ([ADR-0009](./0009-platform-self-provisioning-stack.md)), that single Application is now the *only* Access Application in the stack — it gates the dashboard's pages the same way it gates `/v1/*`, where before the dashboard had its own separate, `allow-team`-only Application. **Accepted consequence:** a CI service token can now also load the dashboard's page shell, where previously it could reach only `/v1/*`. It still can't read anything through `/v1/*` (`requireIdentityMiddleware` still 401s a JWT with no `email` claim, unchanged), so this only widens "can fetch static HTML/JS," not data access — the same "not worth a second Application" reasoning as the paragraph above, applied one level up.

The merge also removed CORS entirely: the API used to be cross-origin from the dashboard, needing `DASHBOARD_ORIGIN`-scoped `cors()` middleware plus `credentials: "include"` on the dashboard's client so the Access session cookie could cross the Worker boundary. Same-origin now, none of that exists — the browser sends the session cookie to `/v1/*` as a matter of course.
