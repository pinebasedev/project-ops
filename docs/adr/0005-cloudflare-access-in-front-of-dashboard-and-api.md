# Cloudflare Access protects both the dashboard and the API, provisioned as code

Status: accepted. Amended by [ADR-0011](./0011-one-access-application-identity-scoped-reads.md) (Google login, one Access Application, identity-scoped reads) and [ADR-0010](./0010-managed-project-credentials-from-a-bootstrap-stack.md) (how the service-token credentials reach a managed project).
Date: 2026-09-05

Both the dashboard and the control-plane API — one SvelteKit Worker, the API mounted same-origin at `/v1/*` ([ADR-0009](./0009-platform-self-provisioning-stack.md)) — sit behind Cloudflare Access (Zero Trust). The Access application, policies, and service tokens are declared as Alchemy resources in the same stack that provisions the rest of the project (`Cloudflare.Access.Application`, `Access.Policy`, `Access.ServiceToken`) — not a manual, skippable step taken separately in Cloudflare's dashboard. This makes Access mandatory for anyone deploying this project: `alchemy deploy` will not stand up a reachable, working system without it.

- **Two kinds of caller**: an interactive-login policy (`allow-team`, a single allow-listed email) for the operator using the dashboard, and a Service Token policy (`allow-ci`) for managed projects' GitHub Actions workflows, which authenticate with a `CF-Access-Client-Id`/`CF-Access-Client-Secret` pair (an `Access.ServiceToken` resource).
- **Defense in depth**: the Worker itself also verifies the `Cf-Access-Jwt-Assertion` header server-side (against the Zero Trust team's JWKS), rather than trusting the network path alone. The app stays non-functional even if Access were ever misconfigured or bypassed at the edge.

This sits entirely on top of, and independent from, the per-project bearer tokens (see `Project` in [the glossary](../architecture.md#glossary)) used to authorize *which* Project a write belongs to — Access answers "can this request reach the Worker at all," the per-project token still answers "which project." A leaked Access service token doesn't expose project data on its own; a request still needs a valid per-project token to write anything.

## Consequences

Every managed project's GitHub Actions workflow needs two more repo secrets (`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`) alongside `CLOUDFLARE_API_TOKEN` and `PROJECT_OPS_TOKEN` — four total. Anyone self-hosting this project needs a Cloudflare Zero Trust org (free tier covers small user counts); this is a hard dependency of the project, not an optional hardening step.
