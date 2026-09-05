# Control-plane state lives in D1 only — no Durable Objects

Status: accepted

Alchemy's own remote state store already gives per-stage isolation and durability for *infrastructure* state. The control plane's *domain* data (Projects, Environments, Deployments, CIRuns) is written by a small, sequential set of steps from a single GitHub Actions run per deployment, with no requirement for real-time log streaming and only three deployment statuses (`in_progress`, `done`, `failed`). D1 alone handles this comfortably: relational querying for the target questions ("what's in prod," "what changed between two deployments," "which PR environments are active") and ordinary transactional writes for status updates, without the operational surface of a second storage primitive.

## Considered Options

A Durable Object per active Environment was considered for single-writer coordination and live log streaming, but neither need is present in this version: deployment status is coarse (3 states) and nothing in the dashboard needs to watch a deployment progress in real time.

## Consequences

If a genuine real-time-streaming or multi-writer-coordination need shows up later, a Durable Object per active Environment remains a natural, additive extension on top of D1 — not a rearchitecture.
