# One Access Application for the whole Worker; dashboard reads require an identity claim

Status: accepted. Amends [ADR-0005](./0005-cloudflare-access-in-front-of-dashboard-and-api.md).
Date: 2026-09-22

The dashboard login is Google, through the Zero Trust org's Google identity provider, and the allow-list is a single email (`CF_ACCESS_ALLOW_EMAIL`) rather than a domain or group — this is a single-operator platform.

Every managed project's CI shares the same `allow-ci` service token. Without further scoping, any of them could read every other project's environments and deployments through the control plane's read routes, which exist only for the dashboard: CI only ever calls `POST` routes.

**Decision:** put `allow-team` and `allow-ci` on one `Access.Application` covering the whole Worker — dashboard pages and `/v1/*` alike — and split reads from writes server-side, on a claim the verified JWT already carries: an identity login has an `email` claim, a service-token login doesn't. `middleware/requireIdentity.ts` requires that claim on the four read routes (`GET /v1/projects`, `GET /v1/projects/:id/environments`, `GET /v1/environments/:id`, `GET /v1/deployments/:id`). The write routes stay scoped by the per-project bearer token, which the dashboard doesn't hold, so it structurally can't call them.

## Considered Options

A second, path-scoped Access Application would enforce the read/write split at the perimeter, where a route-handler bug couldn't break it. Rejected as more infrastructure than a single-operator platform needs. The same reasoning left out a path-scoped edge bypass for `/v1/health`: it is exempt only from the server-side check, so an external uptime probe needs service-token headers.

## Consequences

A CI service token can load the dashboard's page shell (static HTML/JS), though not any data through `/v1/*`. With the dashboard and API on one origin, there is no CORS configuration and the browser sends the Access session cookie to `/v1/*` as a matter of course.
