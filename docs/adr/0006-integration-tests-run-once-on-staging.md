# Integration tests run once, on staging after merge — not per PR

Status: accepted. The live suite itself is not implemented yet (see below).
Date: 2026-09-05

The Integration Test suite runs a single time per merge, against the `staging` Environment, right after a PR merges into the `staging` branch and triggers its redeploy. It does not run against ephemeral PR Environments. PR Environments are still provisioned and deployed on every push (for the preview URL and manual review), and still gated by unit tests — they just don't get a live Integration Test run on every commit.

## Considered Options

Running Integration Tests on every PR push was the original plan, and it's what would let the dashboard answer "which integration tests failed for this PR" literally, per PR, before merge. It was rejected because a PR iterated on with many pushes would trigger a live integration run (real Alchemy-provisioned infra, real requests) on every single push — wasteful for a suite meant to cover the most important features, not exhaustive coverage. Running once per merge, against staging, cuts that to one run per landed change.

## Consequences

Integration failures are now caught **after** a PR has already merged into `staging`, not before — recovery is a revert or fix-forward, not a blocked merge. The target question "which integration tests failed for this PR?" is answered via the staging Deployment that resulted from merging it, not a dedicated per-PR run. Because promotion (`staging` → `main`) is a plain git merge with no automated test gate (ADR-0002), the dashboard surfacing staging's current Integration Test status is what actually prevents someone from promoting a broken state — this makes that dashboard signal load-bearing, not cosmetic.

## Current state

This ADR decides *when* the live suite runs, not what it's made of — that part (in the managed project's repo) is deferred and not scoped yet. Two layers are wanted, not just the one this ADR describes:

- **The live suite this ADR governs** — real HTTP against the deployed `staging` URL, through whatever's actually in front of it (Cloudflare Access included). Closer to what's usually called an **e2e** test by industry convention (external, black-box, against a fully deployed artifact) than "integration" in the stricter sense, even though this repo's naming (this ADR, the `deployments` table's `integration_tests_*` columns, the control-plane's `/integration-results` route, the dashboard panel) calls it "Integration Test" throughout. Needs its own Access service-token credential to clear the perimeter, since `staging` is gated (ADR-0005) — CI has no browser for an interactive login.
- **A true integration layer** (not yet designed) — the app's own code exercised in-process against a local D1, no network, no deployed infra. In demo-project, the API's `AppTestOverrides` (`createDb`, `createAuth`, `resolveSession`, `resolveSubscription`) already gives this a seam to inject a local test DB — the app was built for it, even though nothing uses it yet. This layer is cheap enough to run on every PR, gating merges the way the live suite structurally can't (see "Considered Options" above).

Both are wanted together — the live suite alone was implemented once and rolled back, to land as one coherent piece with the integration layer rather than in two passes. Revisit this ADR when that's scoped.
