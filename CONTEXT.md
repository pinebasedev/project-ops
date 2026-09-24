# Project Ops

A lightweight, opinionated internal developer platform for applications running on Cloudflare: it provisions ephemeral per-PR infrastructure, promotes commits through staging and production, and gives developers (and their AI agents) a single place to see what's deployed and why.

## Language

**Project**:
An application onboarded into the platform for lifecycle management (e.g., demo-project, which lives in its own repository). Owns one or more Environments.
_Avoid_: App, service, repo

**Environment**:
A deployed instance of a Project's infrastructure, provisioned by Alchemy. Comes in three kinds, all the same entity type distinguished by a `kind` field: `ephemeral` (one per open PR, auto-destroyed when the PR merges), `staging` (one per Project, tracks the `staging` branch), and `production` (one per Project, tracks `main`).
_Avoid_: Deployment target, instance, stage (see Stage)

**Stage**:
Alchemy's own term for the isolation key it uses to scope provisioned resource names and state (`pr-{number}`, `staging`, `prod`). Maps 1:1 to an Environment. Use "Stage" only when talking about Alchemy's provisioning mechanism specifically; use "Environment" for the platform-level concept.
_Avoid_: Environment (as a synonym when discussing Alchemy internals)

**Deployment**:
A single provisioning-and-release event for an Environment: one Alchemy apply plus the application code it shipped, tied to a specific commit. Has a status of `in_progress`, `done`, or `failed`.

**Integration Test**:
The test suite that runs once, live, against the `staging` Environment right after a merge into the `staging` branch triggers its redeploy — exercising the real deployed system (real bindings, real edge network), not a simulation. Results are recorded against that Deployment. Does not run against ephemeral PR Environments (see ADR-0006) — those are still provisioned and deployed for manual/visual review, gated only by unit tests. Distinct from unit tests, which run earlier in CI as a merge gate, before any infrastructure is provisioned. Recorded as an aggregate pass/fail count plus a link to the GitHub Actions run — not per-test names (see ADR-0007).
_Avoid_: Smoke test, end-to-end test (both used loosely earlier in this project's design discussion for the same concept — Integration Test is the canonical term)

**Promotion**:
Shipping the code currently running in staging to production. Triggered by merging the `staging` branch into `main` in GitHub — not a control-plane or dashboard action. The platform observes the resulting GitHub Actions run and records the production Deployment; it does not perform or gate the merge itself.
_Avoid_: Release, publish
