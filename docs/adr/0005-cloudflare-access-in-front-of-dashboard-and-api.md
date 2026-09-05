# Cloudflare Access protects both the dashboard and the API, provisioned as code

Status: accepted

Both the dashboard and the control-plane API sit behind Cloudflare Access (Zero Trust). The Access application, policy, and service tokens are declared as Alchemy resources in the same stack that provisions the rest of the project (`Cloudflare.Access.Application`, `Access.Policy`, `Access.Group`, `Access.ServiceToken`) — not a manual, skippable step taken separately in Cloudflare's dashboard. This makes Access mandatory for anyone deploying this project: `alchemy deploy` will not stand up a reachable, working system without it.

- **Dashboard**: an Access Policy requiring interactive IdP login (GitHub), scoped to an allow-listed email/group.
- **Control-plane API**: an Access Policy requiring a valid Access Service Token. Managed projects' GitHub Actions workflows authenticate with a `CF-Access-Client-Id`/`CF-Access-Client-Secret` pair (an `Access.ServiceToken` resource). The local MCP server authenticates via `cloudflared access login`'s cached interactive session.
- **Defense in depth**: the Worker itself also verifies the `Cf-Access-Jwt-Assertion` header server-side (against the Zero Trust team's JWKS), rather than trusting the network path alone. The app stays non-functional even if Access were ever misconfigured or bypassed at the edge.

This sits entirely on top of, and independent from, the per-project bearer tokens ([[CONTEXT]]: `Project`) used to authorize *which* Project a write belongs to — Access answers "can this request reach the Worker at all," the per-project token still answers "which project." A leaked Access service token doesn't expose project data on its own; a request still needs a valid per-project token to write anything.

## Consequences

Every managed project's GitHub Actions workflow needs two more repo secrets (`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`) alongside `CLOUDFLARE_API_TOKEN` and `IDP_PROJECT_TOKEN` — four total. Anyone self-hosting this project needs a Cloudflare Zero Trust org (free tier covers small user counts); this is now a hard dependency of the project, not an optional hardening step.
