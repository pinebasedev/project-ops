# The platform holds no Cloudflare API credential

Status: accepted. Supersedes [ADR-0004](./0004-query-observability-directly.md) and the Secrets Store part of [ADR-0009](./0009-platform-self-provisioning-stack.md).
Date: 2026-09-22

The control plane used to hold an account-wide Cloudflare API token (in Secrets Store on deploy) for one feature: a recent-errors panel that queried the Workers Observability Telemetry API ([ADR-0004](./0004-query-observability-directly.md)). That panel duplicated what the Cloudflare dashboard already shows, and an account-wide token in a Worker binding is a large blast radius for it.

**Decision:** remove the recent-errors feature and, with it, every Cloudflare credential the platform held. The Worker's only bindings are `DB` and the two plain Access strings (`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`). Alchemy's own deploy-time authentication is an OAuth session (`alchemy profile edit --add Cloudflare`, with the scopes customized to add `access:write`, which isn't in Alchemy's default set), cached to `~/.alchemy` on the deploying machine and refreshed automatically. No API token is minted, pasted, or bound anywhere in this stack.

## Consequences

Operators look at errors in the Cloudflare dashboard's Workers Logs, not in this platform's dashboard. The platform's whole Cloudflare credential surface is one OAuth session, local to whichever machine deploys.
