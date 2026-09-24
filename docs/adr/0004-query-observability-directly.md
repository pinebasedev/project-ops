# Query Cloudflare Observability directly — no Tail Worker relay

Status: superseded by [ADR-0012](./0012-no-platform-cloudflare-api-credential.md). The recent-errors feature this describes was removed; kept for the record.
Date: 2026-09-05

The control plane answers "what errors appeared after this deployment?" by calling Cloudflare's Workers Observability Telemetry API (`/accounts/{account_id}/workers/observability/telemetry/query`) directly, on demand, rather than running a Tail Worker to continuously relay every managed Worker's logs into our own D1.

## Considered Options

A Tail Worker relay (attach to each managed Worker, forward `console.log`/exceptions into D1 in real time) is the more commonly recommended pattern for building your own observability stack, and remains free-tier-compatible unlike Logpush. But it means running and operating an extra Worker per Project plus a growing log table, for a query pattern ("show me errors since deployment X") that's inherently a point-in-time lookup, not something that needs continuous local storage. Cloudflare's own Telemetry API already stores and indexes this data; querying it directly avoids duplicating it.

## Consequences

This makes the control plane dependent on Cloudflare's Telemetry API being available and reasonably fast at query time (no local cache/fallback). If correlating logs precisely to a Deployment turns out to need Workers' native Versions/gradual-deployments tagging and that tagging isn't exposed the way we expect, this decision should be revisited — worth confirming during implementation, not assumed now.

## Implementation notes

- **Deployment correlation is by time window, not version tags.** The errors route asks for events between the latest Deployment's `created_at` and now. This sidesteps the Versions/gradual-deployments tagging concern above; if per-commit precision is ever needed, revisit then.
- **The queried Worker name is a convention, not stored data.** `workerServiceName(project, environment)` returns `<project.name>-<environment.stageName>` (e.g. `demo-project-staging`, `demo-project-pr-42`), matched against the Telemetry API's `$metadata.service` field. The name is derived, not stored. If that convention has to change, `workerServiceName` is the single place to change it.
- **The credentials are a control-plane operational secret**, not a per-Project token: one Cloudflare API token + account ID. The token lived in the account Secrets Store on deploy and a plain string locally; the account id was a plain binding. The errors route degrades to a 503 "not configured" when they're absent rather than failing hard.
