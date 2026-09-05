# Query Cloudflare Observability directly — no Tail Worker relay

Status: accepted

The control plane answers "what errors appeared after this deployment?" by calling Cloudflare's Workers Observability Telemetry API (`/accounts/{account_id}/workers/observability/telemetry/query`) directly, on demand, rather than running a Tail Worker to continuously relay every managed Worker's logs into our own D1.

## Considered Options

A Tail Worker relay (attach to each managed Worker, forward `console.log`/exceptions into D1 in real time) is the more commonly recommended pattern for building your own observability stack, and remains free-tier-compatible unlike Logpush. But it means running and operating an extra Worker per Project plus a growing log table, for a query pattern ("show me errors since deployment X") that's inherently a point-in-time lookup, not something that needs continuous local storage. Cloudflare's own Telemetry API already stores and indexes this data; querying it directly avoids duplicating it.

## Consequences

This makes the control plane dependent on Cloudflare's Telemetry API being available and reasonably fast at query time (no local cache/fallback). If correlating logs precisely to a Deployment turns out to need Workers' native Versions/gradual-deployments tagging and that tagging isn't exposed the way we expect, this decision should be revisited — worth confirming during implementation, not assumed now.
