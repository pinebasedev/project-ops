# Architecture Decision Records

Each ADR records one decision that is hard to reverse, surprising without context, and the result of a real trade-off. Terms follow the glossary in [`CONTEXT.md`](../../CONTEXT.md); [`ARCHITECTURE.md`](../../ARCHITECTURE.md) ties the decisions together.

| # | Decision | Status | Date |
|---|---|---|---|
| [0001](./0001-alchemy-provisioning-driven-by-github-actions.md) | Provision infrastructure with Alchemy, driven from GitHub Actions, using remote Cloudflare-backed state | Accepted, extended by 0009 and 0010 | 2026-09-05 |
| [0002](./0002-promotion-is-a-git-merge.md) | Promotion to production is a Git merge, not a control-plane action | Accepted | 2026-09-05 |
| [0003](./0003-d1-only-no-durable-objects.md) | Control-plane state lives in D1 only — no Durable Objects | Accepted | 2026-09-05 |
| [0004](./0004-query-observability-directly.md) | Query Cloudflare Observability directly — no Tail Worker relay | Superseded by 0012 | 2026-09-05 |
| [0005](./0005-cloudflare-access-in-front-of-dashboard-and-api.md) | Cloudflare Access protects both the dashboard and the API, provisioned as code | Accepted, amended by 0010 and 0011 | 2026-09-05 |
| [0006](./0006-integration-tests-run-once-on-staging.md) | Integration tests run once, on staging after merge — not per PR | Accepted, suite not yet implemented | 2026-09-05 |
| [0007](./0007-no-github-api-access-link-out-instead.md) | Control plane never calls GitHub's API — link out instead of fetching | Accepted | 2026-09-05 |
| [0008](./0008-no-ai-interface-this-version.md) | No dedicated AI/agent interface in this version | Accepted | 2026-09-05 |
| [0009](./0009-platform-self-provisioning-stack.md) | The platform provisions itself with one Alchemy stack | Accepted, partly superseded by 0012 | 2026-09-06 |
| [0010](./0010-managed-project-credentials-from-a-bootstrap-stack.md) | A managed project's credentials are minted by a one-time Alchemy bootstrap stack | Accepted, partially implemented | 2026-09-22 |
| [0011](./0011-one-access-application-identity-scoped-reads.md) | One Access Application for the whole Worker; dashboard reads require an identity claim | Accepted | 2026-09-22 |
| [0012](./0012-no-platform-cloudflare-api-credential.md) | The platform holds no Cloudflare API credential | Accepted | 2026-09-22 |

## Writing a new ADR

Take the next number and add a row above. Keep it short — often a single paragraph is enough:

```md
# {Short title of the decision}

Status: proposed | accepted | superseded by ADR-NNNN
Date: YYYY-MM-DD

{Context, what was decided, and why.}

## Considered Options   (only if the rejected alternatives are worth remembering)

## Consequences         (only if the downstream effects aren't obvious)
```

An accepted ADR's body isn't rewritten when the decision changes. Write a new ADR, and update the old one's `Status:` line to point at it.
